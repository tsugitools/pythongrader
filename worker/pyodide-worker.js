/**
 * PythonGrader Pyodide Web Worker.
 * Loads a pinned Pyodide build, runs student.py, and grades via harness.py.
 *
 * Message protocol (DESIGN.md):
 *   { protocol_version, request_id, operation, payload }
 * Replies:
 *   { protocol_version, request_id, operation, status, ... }
 */
'use strict';

var PROTOCOL_VERSION = 1;
var PYODIDE_VERSION = '0.27.5';
var PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/';
var WORK_DIR = '/home/pyodide/work';
var MAX_OUTPUT_CHARS = 100000;

var pyodide = null;
var harnessSource = null;
var resultSource = null;
var ready = false;

function reply(requestId, operation, status, extra) {
    var msg = Object.assign(
        {
            protocol_version: PROTOCOL_VERSION,
            request_id: requestId,
            operation: operation,
            status: status
        },
        extra || {}
    );
    self.postMessage(msg);
}

function truncateOutput(text) {
    if (text == null) return '';
    text = String(text);
    if (text.length <= MAX_OUTPUT_CHARS) return text;
    return text.slice(0, MAX_OUTPUT_CHARS - 20) + '\n... [truncated]';
}

function workerUrl(relativePath) {
    try {
        return new URL(relativePath, self.location.href).href;
    } catch (e) {
        return relativePath;
    }
}

async function fetchText(url) {
    var res = await fetch(url);
    if (!res.ok) {
        throw new Error('Failed to fetch ' + url + ' (' + res.status + ')');
    }
    return await res.text();
}

async function ensureHarnessSources() {
    if (harnessSource && resultSource) return;
    var base = workerUrl('./');
    resultSource = await fetchText(base + 'result.py');
    harnessSource = await fetchText(base + 'harness.py');
}

async function loadPyodideRuntime() {
    if (pyodide) return pyodide;
    reply(null, 'init', 'loading', {
        message: 'Loading Pyodide ' + PYODIDE_VERSION + '…'
    });
    importScripts(PYODIDE_INDEX + 'pyodide.js');
    pyodide = await loadPyodide({
        indexURL: PYODIDE_INDEX
    });
    await ensureHarnessSources();
    return pyodide;
}

function resetWorkDir() {
    var FS = pyodide.FS;
    try {
        // Remove previous work tree if present.
        if (FS.analyzePath(WORK_DIR).exists) {
            var walk = function (path) {
                var entries = FS.readdir(path);
                for (var i = 0; i < entries.length; i++) {
                    var name = entries[i];
                    if (name === '.' || name === '..') continue;
                    var child = path + '/' + name;
                    var stat = FS.stat(child);
                    if (FS.isDir(stat.mode)) {
                        walk(child);
                        FS.rmdir(child);
                    } else {
                        FS.unlink(child);
                    }
                }
            };
            walk(WORK_DIR);
        } else {
            FS.mkdirTree(WORK_DIR);
        }
    } catch (e) {
        // Fall through and recreate.
        try {
            FS.mkdirTree(WORK_DIR);
        } catch (e2) {
            /* ignore */
        }
    }

    FS.writeFile(WORK_DIR + '/result.py', resultSource);
    FS.writeFile(WORK_DIR + '/harness.py', harnessSource);
}

function prepareExecution(studentSource, evaluationSource) {
    resetWorkDir();
    var FS = pyodide.FS;
    FS.writeFile(WORK_DIR + '/student.py', studentSource == null ? '' : String(studentSource));
    if (evaluationSource != null) {
        FS.writeFile(WORK_DIR + '/evaluation.py', String(evaluationSource));
    }
    pyodide.runPython(
        [
            'import os, sys, importlib',
            'os.chdir(' + JSON.stringify(WORK_DIR) + ')',
            'work = ' + JSON.stringify(WORK_DIR),
            'if work in sys.path:',
            '    sys.path.remove(work)',
            'sys.path.insert(0, work)',
            // Drop cached student/evaluation/harness modules between runs.
            'for name in list(sys.modules):',
            "    if name in ('student', 'evaluation', 'harness', 'result',",
            "                '_pythongrader_evaluation') or name.startswith('student'):",
            '        del sys.modules[name]',
            'importlib.invalidate_caches()'
        ].join('\n')
    );
}

function parsePythonJson(globalName) {
    var raw = pyodide.globals.get(globalName);
    var text = typeof raw === 'string' ? raw : String(raw);
    return JSON.parse(text);
}

async function runStudent(payload) {
    var studentSource = (payload && payload.student_source) || '';
    var stdinText = (payload && payload.stdin) != null ? String(payload.stdin) : '';
    prepareExecution(studentSource, null);

    var code = [
        'import io, sys, json, time, runpy',
        'from result import format_exception',
        '',
        '_stdout = io.StringIO()',
        '_stderr = io.StringIO()',
        '_stdin = io.StringIO(' + JSON.stringify(stdinText) + ')',
        'sys.stdout = _stdout',
        'sys.stderr = _stderr',
        'sys.stdin = _stdin',
        '_started = time.perf_counter()',
        '_exc = None',
        'try:',
        "    runpy.run_path('student.py', run_name='__main__')",
        'except SystemExit:',
        '    pass',
        'except Exception as e:',
        '    _exc = format_exception(e)',
        '_duration_ms = int(round((time.perf_counter() - _started) * 1000))',
        '_result_json = json.dumps({',
        "    'stdout': _stdout.getvalue(),",
        "    'stderr': _stderr.getvalue(),",
        "    'exception': _exc,",
        "    'duration_ms': _duration_ms,",
        '})'
    ].join('\n');

    pyodide.runPython(code);
    var result = parsePythonJson('_result_json');
    return {
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
        exception: result.exception || null,
        duration_ms: result.duration_ms || 0
    };
}

async function gradeStudent(payload) {
    var studentSource = (payload && payload.student_source) || '';
    var evaluationSource = (payload && payload.evaluation_source) || '';
    if (!evaluationSource) {
        return {
            status: 'grader_error',
            earned: 0,
            possible: 0,
            duration_ms: 0,
            tests: [],
            message: 'Missing evaluation source',
            traceback: '',
            stdout: '',
            stderr: ''
        };
    }

    prepareExecution(studentSource, evaluationSource);

    var code = [
        'import io, sys, json',
        'from harness import run_evaluation',
        '',
        '_stdout = io.StringIO()',
        '_stderr = io.StringIO()',
        '_real_stdout, _real_stderr = sys.stdout, sys.stderr',
        'sys.stdout = _stdout',
        'sys.stderr = _stderr',
        'try:',
        '    _grade = run_evaluation("evaluation.py")',
        'finally:',
        '    sys.stdout = _real_stdout',
        '    sys.stderr = _real_stderr',
        "    _grade['stdout'] = _stdout.getvalue()",
        "    _grade['stderr'] = _stderr.getvalue()",
        '    _grade_json = json.dumps(_grade)'
    ].join('\n');

    pyodide.runPython(code);
    var grade = parsePythonJson('_grade_json');

    return {
        status: grade.status || 'complete',
        tests: grade.tests || [],
        message: grade.message || '',
        traceback: grade.traceback || '',
        duration_ms: grade.duration_ms || 0,
        stdout: truncateOutput(grade.stdout),
        stderr: truncateOutput(grade.stderr)
    };
}

self.onmessage = async function (ev) {
    var msg = ev.data || {};
    var requestId = msg.request_id;
    var operation = msg.operation;
    var payload = msg.payload || {};

    try {
        if (operation === 'init') {
            await loadPyodideRuntime();
            ready = true;
            reply(requestId, 'init', 'ready', {
                pyodide_version: PYODIDE_VERSION,
                message: 'Pyodide ready'
            });
            return;
        }

        if (!ready || !pyodide) {
            await loadPyodideRuntime();
            ready = true;
        }

        if (operation === 'run') {
            reply(requestId, 'run', 'running');
            var runResult = await runStudent(payload);
            reply(requestId, 'run', 'complete', {
                stdout: runResult.stdout,
                stderr: runResult.stderr,
                exception: runResult.exception || null,
                duration_ms: runResult.duration_ms
            });
            return;
        }

        if (operation === 'grade') {
            reply(requestId, 'grade', 'running');
            var gradeResult = await gradeStudent(payload);
            reply(requestId, operation, gradeResult.status === 'grader_error' ? 'grader_error' : 'complete', {
                earned: 0,
                possible: 0,
                duration_ms: gradeResult.duration_ms,
                tests: gradeResult.tests,
                message: gradeResult.message || '',
                traceback: gradeResult.traceback || '',
                stdout: gradeResult.stdout || '',
                stderr: gradeResult.stderr || ''
            });
            return;
        }

        reply(requestId, operation || 'unknown', 'worker_error', {
            message: 'Unknown operation: ' + operation
        });
    } catch (err) {
        reply(requestId, operation || 'unknown', 'worker_error', {
            message: (err && err.message) || String(err),
            traceback: (err && err.stack) || ''
        });
    }
};
