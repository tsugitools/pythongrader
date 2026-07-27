/**
 * PythonGrader runtime — worker lifecycle, request IDs, timeout, dirty state.
 *
 * Exposed as window.PythonGraderRuntime.
 */
(function (global) {
    'use strict';

    var PROTOCOL_VERSION = 1;
    var DEFAULT_TIMEOUT_MS = 5000;
    var DEFAULT_WORKER_URL = 'worker/pyodide-worker.js';

    function createRuntime(options) {
        options = options || {};
        var workerUrl = options.workerUrl || DEFAULT_WORKER_URL;
        var onStatus = typeof options.onStatus === 'function' ? options.onStatus : function () {};

        var worker = null;
        var nextSeq = 1;
        var currentRequestId = null;
        var pending = null;
        var timeoutTimer = null;
        var ready = false;
        var initPromise = null;

        var sourceRevision = 0;
        var runningRevision = -1;

        function bumpSourceRevision() {
            sourceRevision += 1;
            return sourceRevision;
        }

        function getSourceRevision() {
            return sourceRevision;
        }

        function getRunningRevision() {
            return runningRevision;
        }

        function isClean() {
            return runningRevision === sourceRevision && runningRevision >= 0;
        }

        function canGrade() {
            return ready && isClean();
        }

        function markCleanAfterRun() {
            runningRevision = sourceRevision;
        }

        function resetRevisions() {
            sourceRevision = 0;
            runningRevision = -1;
        }

        function clearTimeoutTimer() {
            if (timeoutTimer != null) {
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
            }
        }

        function rejectPending(err) {
            clearTimeoutTimer();
            if (pending) {
                var p = pending;
                pending = null;
                currentRequestId = null;
                p.reject(err);
            }
        }

        function terminateWorker() {
            clearTimeoutTimer();
            if (worker) {
                try {
                    worker.terminate();
                } catch (e) {
                    /* ignore */
                }
                worker = null;
            }
            ready = false;
            initPromise = null;
        }

        function handleMessage(ev) {
            var msg = ev.data || {};
            if (msg.protocol_version !== PROTOCOL_VERSION) return;

            // Unsolicited loading/ready during init may have request_id null.
            if (msg.status === 'loading') {
                onStatus('loading', msg);
                return;
            }

            if (pending && msg.request_id === currentRequestId) {
                if (msg.status === 'running') {
                    onStatus('running', msg);
                    return;
                }
                if (
                    msg.status === 'complete' ||
                    msg.status === 'ready' ||
                    msg.status === 'worker_error' ||
                    msg.status === 'grader_error'
                ) {
                    clearTimeoutTimer();
                    var p = pending;
                    pending = null;
                    currentRequestId = null;
                    if (msg.status === 'worker_error') {
                        p.reject(Object.assign(new Error(msg.message || 'Worker error'), { result: msg }));
                    } else {
                        p.resolve(msg);
                    }
                    return;
                }
            }

            // Ignore stale messages from superseded requests.
        }

        function attachWorker(w) {
            worker = w;
            worker.onmessage = handleMessage;
            worker.onerror = function (err) {
                onStatus('worker_error', {
                    message: (err && err.message) || 'Worker script error'
                });
                rejectPending(
                    new Error((err && err.message) || 'Worker script error')
                );
            };
        }

        function createWorker() {
            var w = new Worker(workerUrl);
            attachWorker(w);
            return w;
        }

        function callWorker(operation, payload, timeoutMs) {
            if (!worker) {
                return Promise.reject(new Error('Worker not initialized'));
            }
            if (pending) {
                return Promise.reject(new Error('Another operation is in progress'));
            }

            var requestId = operation + '-' + nextSeq++;
            currentRequestId = requestId;
            timeoutMs = timeoutMs == null ? DEFAULT_TIMEOUT_MS : timeoutMs;

            return new Promise(function (resolve, reject) {
                pending = { resolve: resolve, reject: reject };
                timeoutTimer = setTimeout(function () {
                    var timedOutId = requestId;
                    pending = null;
                    currentRequestId = null;
                    timeoutTimer = null;
                    onStatus('timeout', {
                        request_id: timedOutId,
                        operation: operation,
                        message: 'Execution timed out after ' + timeoutMs + 'ms'
                    });
                    terminateWorker();
                    var err = new Error('Execution timed out after ' + timeoutMs + 'ms');
                    err.code = 'timeout';
                    err.request_id = timedOutId;
                    err.operation = operation;
                    // Rebuild replacement worker, then reject so callers can await recovery via err.recovered.
                    err.recovered = init()
                        .then(function (msg) {
                            onStatus('ready', msg);
                            return msg;
                        })
                        .catch(function (initErr) {
                            onStatus('worker_error', {
                                message: (initErr && initErr.message) || String(initErr)
                            });
                            throw initErr;
                        });
                    reject(err);
                }, timeoutMs);

                worker.postMessage({
                    protocol_version: PROTOCOL_VERSION,
                    request_id: requestId,
                    operation: operation,
                    payload: payload || {}
                });
            });
        }

        function init() {
            if (initPromise) return initPromise;
            if (!worker) {
                createWorker();
            }
            onStatus('loading', { message: 'Starting worker…' });
            initPromise = callWorker('init', {}, 120000)
                .then(function (msg) {
                    ready = true;
                    onStatus('ready', msg);
                    return msg;
                })
                .catch(function (err) {
                    ready = false;
                    initPromise = null;
                    throw err;
                });
            return initPromise;
        }

        function restart() {
            rejectPending(new Error('Worker restarted'));
            terminateWorker();
            resetRevisions();
            createWorker();
            return init();
        }

        function fetchAssets(assetDecls) {
            var decls = Array.isArray(assetDecls) ? assetDecls : [];
            if (!decls.length) return Promise.resolve([]);
            return Promise.all(
                decls.map(function (a) {
                    if (!a || !a.source || !a.mount) {
                        return Promise.reject(new Error('Asset declaration missing source/mount'));
                    }
                    return fetch(a.source, { credentials: 'same-origin' }).then(function (resp) {
                        if (!resp.ok) {
                            throw new Error(
                                'Missing required asset: ' + a.source + ' (' + resp.status + ')'
                            );
                        }
                        return resp.text().then(function (text) {
                            return { mount: a.mount, text: text };
                        });
                    });
                })
            );
        }

        function run(studentSource, stdin, timeoutMs, assetDecls) {
            return init()
                .then(function () {
                    return fetchAssets(assetDecls);
                })
                .then(function (assets) {
                    onStatus('running', { operation: 'run' });
                    return callWorker(
                        'run',
                        {
                            student_source: studentSource,
                            stdin: stdin == null ? '' : String(stdin),
                            assets: assets
                        },
                        timeoutMs
                    );
                })
                .then(function (msg) {
                    // Successful run (even with student exception) clears dirty state.
                    markCleanAfterRun();
                    onStatus('complete', msg);
                    return msg;
                });
        }

        function scoreTests(tests, metadata, grading) {
            metadata = metadata || {};
            grading = grading || {};
            var scored = [];
            var earned = 0;
            var possible = 0;
            var seen = {};

            (tests || []).forEach(function (t) {
                var meta = metadata[t.id] || {};
                var points =
                    typeof meta.points === 'number'
                        ? meta.points
                        : typeof meta.points === 'string'
                          ? parseFloat(meta.points) || 0
                          : 0;
                possible += points;
                var got = 0;
                if (t.status === 'pass') {
                    got = points;
                    earned += points;
                }
                seen[t.id] = true;
                scored.push({
                    id: t.id,
                    title: meta.title || t.id,
                    group: meta.group || '',
                    status: t.status,
                    earned: got,
                    possible: points,
                    message: t.message || '',
                    traceback: t.traceback || '',
                    feedback: meta.feedback || '',
                    duration_ms: t.duration_ms || 0
                });
            });

            // Metadata entries with no discovered test → leave possible from grading max if set.
            Object.keys(metadata).forEach(function (id) {
                if (seen[id]) return;
                var meta = metadata[id] || {};
                var points = typeof meta.points === 'number' ? meta.points : 0;
                possible += points;
                scored.push({
                    id: id,
                    title: meta.title || id,
                    group: meta.group || '',
                    status: 'grader_error',
                    earned: 0,
                    possible: points,
                    message: 'Test was declared in metadata but not discovered',
                    traceback: '',
                    feedback: meta.feedback || '',
                    duration_ms: 0
                });
            });

            if (typeof grading.maximum_points === 'number') {
                possible = grading.maximum_points;
            }

            return { tests: scored, earned: earned, possible: possible };
        }

        function grade(studentSource, evaluationSource, testMetadata, grading, timeoutMs, assetDecls) {
            if (!canGrade()) {
                return Promise.reject(
                    new Error('Grade is disabled until you Run the current source')
                );
            }
            return init()
                .then(function () {
                    return fetchAssets(assetDecls);
                })
                .then(function (assets) {
                    onStatus('running', { operation: 'grade' });
                    return callWorker(
                        'grade',
                        {
                            student_source: studentSource,
                            evaluation_source: evaluationSource,
                            assets: assets
                        },
                        timeoutMs
                    );
                })
                .then(function (msg) {
                    var scored = scoreTests(msg.tests || [], testMetadata, grading);
                    var result = Object.assign({}, msg, {
                        earned: scored.earned,
                        possible: scored.possible,
                        tests: scored.tests
                    });
                    if (msg.status === 'grader_error') {
                        onStatus('grader_error', result);
                    } else {
                        onStatus('complete', result);
                    }
                    return result;
                });
        }

        function isReady() {
            return ready;
        }

        return {
            init: init,
            restart: restart,
            run: run,
            grade: grade,
            bumpSourceRevision: bumpSourceRevision,
            getSourceRevision: getSourceRevision,
            getRunningRevision: getRunningRevision,
            isClean: isClean,
            canGrade: canGrade,
            markCleanAfterRun: markCleanAfterRun,
            resetRevisions: resetRevisions,
            scoreTests: scoreTests,
            isReady: isReady,
            terminate: terminateWorker
        };
    }

    global.PythonGraderRuntime = {
        create: createRuntime,
        PROTOCOL_VERSION: PROTOCOL_VERSION,
        DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS
    };
})(typeof window !== 'undefined' ? window : self);
