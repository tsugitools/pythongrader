/**
 * PythonGrader UI — learner and author modes.
 * PHP injects window.PYTHONGRADER; execution lives in runtime.js + worker.
 */
(function () {
    'use strict';

    var cfg = window.PYTHONGRADER || {};
    var exercise = cfg.exercise || {};
    var RuntimeApi = window.PythonGraderRuntime;
    var Results = window.PythonGraderResults || {};
    var app = document.getElementById('app');
    var runtime = null;
    var saveTimer = null;
    var busy = false;
    var promptEditor = null;

    function $(sel, root) {
        return (root || document).querySelector(sel);
    }

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        attrs = attrs || {};
        Object.keys(attrs).forEach(function (k) {
            if (k === 'className') node.className = attrs[k];
            else if (k === 'text') node.textContent = attrs[k];
            else if (k === 'html') node.innerHTML = attrs[k];
            else if (k === 'hidden') node.hidden = !!attrs[k];
            else node.setAttribute(k, attrs[k]);
        });
        (children || []).forEach(function (c) {
            if (c == null) return;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return node;
    }

    function setTitle() {
        var t = $('#exerciseTitle');
        if (t) t.textContent = exercise.title || '';
    }

    function starterSource() {
        var f = exercise.files && exercise.files['student.py'];
        return (f && typeof f.starter === 'string') ? f.starter : '';
    }

    function solutionSource() {
        var f = exercise.files && exercise.files['student.py'];
        return (f && typeof f.solution === 'string') ? f.solution : '';
    }

    function defaultStdin() {
        return (exercise.run && typeof exercise.run.stdin === 'string')
            ? exercise.run.stdin : '';
    }

    function timeoutMs() {
        var t = exercise.run && exercise.run.timeout_ms;
        return typeof t === 'number' ? t : 5000;
    }

    function evaluationSource() {
        return (exercise.evaluation && exercise.evaluation.source) || '';
    }

    function testMetadata() {
        return (exercise.evaluation && exercise.evaluation.tests) || {};
    }

    function localBackupKey() {
        return (cfg.urls && cfg.urls.persistKey) || 'pythongrader-anon';
    }

    function buildSubmissionPayload() {
        return {
            schema: 'pythongrader-submission',
            version: 1,
            files: {
                'student.py': ($('#student-source') && $('#student-source').value) || ''
            },
            stdin: ($('#stdin') && $('#stdin').value) || '',
            source_revision: runtime ? runtime.getSourceRevision() : 0,
            last_run_revision: runtime ? runtime.getRunningRevision() : -1
        };
    }

    function saveLocalBackup() {
        try {
            localStorage.setItem(localBackupKey(), JSON.stringify(buildSubmissionPayload()));
        } catch (e) { /* quota */ }
    }

    function clearLocalBackup() {
        try {
            localStorage.removeItem(localBackupKey());
        } catch (e) { /* ignore */ }
    }

    function loadInitialSource() {
        var source = starterSource();
        var stdin = defaultStdin();
        var sub = cfg.submission;
        if (sub && sub.files && typeof sub.files['student.py'] === 'string') {
            source = sub.files['student.py'];
            if (typeof sub.stdin === 'string') stdin = sub.stdin;
            return { source: source, stdin: stdin, fromServer: true };
        }
        try {
            var raw = localStorage.getItem(localBackupKey());
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && parsed.files && typeof parsed.files['student.py'] === 'string') {
                    source = parsed.files['student.py'];
                    if (typeof parsed.stdin === 'string') stdin = parsed.stdin;
                }
            }
        } catch (e) { /* ignore */ }
        return { source: source, stdin: stdin, fromServer: false };
    }

    function saveStudentSource(done) {
        saveLocalBackup();
        if (!cfg.urls || !cfg.urls.studentSave || !cfg.hasLink) {
            if (done) done(null);
            return;
        }
        fetch(cfg.urls.studentSave, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildSubmissionPayload())
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (done) done(resp.ok ? null : (body.detail || 'Save failed'));
            });
        }).catch(function (err) {
            if (done) done(err.message || 'Save failed');
        });
    }

    function scheduleAutosave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            saveTimer = null;
            saveStudentSource(null);
        }, 800);
    }

    function setStatus(state, text) {
        var s = $('#status');
        if (!s) return;
        s.dataset.state = state || '';
        s.textContent = text || state || '';
    }

    function setBusy(isBusy) {
        busy = !!isBusy;
        var run = $('#btnRun');
        var grade = $('#btnGrade');
        if (run) run.disabled = busy || !(runtime && runtime.isReady());
        updateGradeButton();
        if (busy && grade) grade.disabled = true;
    }

    function updateGradeButton() {
        var btn = $('#btnGrade');
        var dirty = $('#dirtyNote');
        if (!btn) return;
        var can = !busy && runtime && runtime.canGrade()
            && Object.keys(testMetadata()).length > 0;
        btn.disabled = !can;
        if (dirty) {
            if (!runtime || !runtime.isReady()) {
                dirty.hidden = false;
                dirty.textContent = 'Loading Python runtime…';
            } else if (!runtime.isClean() && runtime.getRunningRevision() >= 0) {
                dirty.hidden = false;
                dirty.textContent = 'Source changed since last Run — Grade is disabled until you Run again.';
            } else if (!runtime.isClean()) {
                dirty.hidden = false;
                dirty.textContent = 'Press Run / Restart before grading.';
            } else {
                dirty.hidden = true;
            }
        }
    }

    function onEdit() {
        if (!runtime) return;
        runtime.bumpSourceRevision();
        updateGradeButton();
        scheduleAutosave();
    }

    function recordAttempt() {
        if (!cfg.urls || !cfg.urls.recordAttempt) return;
        var fd = new FormData();
        fetch(cfg.urls.recordAttempt, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin'
        }).catch(function () { /* best-effort */ });
    }

    function submitGrade(grade) {
        if (!cfg.urls || !cfg.urls.gradeSubmit) {
            return Promise.reject(new Error('Grade submit URL missing'));
        }
        var fd = new FormData();
        fd.append('grade', String(grade));
        fd.append('code', 'PYTHONGRADER');
        return fetch(cfg.urls.gradeSubmit, {
            method: 'POST',
            body: fd,
            credentials: 'same-origin'
        }).then(function (resp) {
            return resp.json().catch(function () {
                return { status: resp.ok ? 'success' : 'failure' };
            }).then(function (body) {
                return { ok: resp.ok, body: body };
            });
        });
    }

    function doRun() {
        if (!runtime || busy) return;
        setBusy(true);
        setStatus('running', 'Running…');
        Results.renderGrade($('#score'), $('#results'), null);
        runtime
            .run(
                $('#student-source').value,
                $('#stdin').value,
                timeoutMs(),
                exercise.assets || []
            )
            .then(function (msg) {
                Results.renderRunOutput($('#stdout'), $('#stderr'), msg);
                setStatus('complete', 'Run complete (' + (msg.duration_ms || 0) + ' ms)');
                scheduleAutosave();
                setBusy(false);
            })
            .catch(function (err) {
                if (err && err.code === 'timeout') {
                    Results.renderRunOutput($('#stdout'), $('#stderr'), {
                        stdout: '',
                        stderr: err.message
                    });
                    setStatus('timeout', 'Timed out — restarting worker…');
                    var recovered = err.recovered || Promise.resolve();
                    recovered
                        .then(function () {
                            setStatus('ready', 'Ready again after timeout');
                        })
                        .catch(function (initErr) {
                            setStatus('worker_error', (initErr && initErr.message) || 'Restart failed');
                        })
                        .finally(function () {
                            setBusy(false);
                            updateGradeButton();
                        });
                    return;
                }
                Results.renderRunOutput($('#stdout'), $('#stderr'), {
                    stdout: '',
                    stderr: (err && err.message) || String(err)
                });
                setStatus('worker_error', 'Run failed');
                setBusy(false);
                updateGradeButton();
            });
    }

    function doGrade() {
        if (!runtime || !runtime.canGrade()) {
            setStatus('fail', 'Run the current source before grading');
            return;
        }
        setBusy(true);
        setStatus('running', 'Grading…');
        runtime
            .grade(
                $('#student-source').value,
                evaluationSource(),
                testMetadata(),
                exercise.grading || {},
                timeoutMs(),
                exercise.assets || []
            )
            .then(function (msg) {
                Results.renderRunOutput($('#stdout'), $('#stderr'), msg);
                Results.renderGrade($('#score'), $('#results'), msg);

                if (msg.status === 'grader_error') {
                    setStatus('grader_error', 'Grader error');
                    setBusy(false);
                    return;
                }

                var possible = msg.possible || 0;
                var earned = msg.earned || 0;
                var grade = possible > 0 ? earned / possible : 0;

                if (!cfg.hasLink || !cfg.urls || !cfg.urls.gradeSubmit) {
                    setStatus('success', 'Score: ' + earned + '/' + possible
                        + ' (not submitted — no LTI placement)');
                    setBusy(false);
                    return;
                }

                setStatus('pending', 'Submitting grade…');
                recordAttempt();
                saveStudentSource(null);
                return submitGrade(grade).then(function (resp) {
                    if (resp.ok || (resp.body && resp.body.status === 'success')) {
                        setStatus('success', 'Grade submitted: ' + earned + '/' + possible);
                    } else {
                        var detail = (resp.body && (resp.body.detail || resp.body.status)) || 'submit failed';
                        setStatus('success', 'Scored ' + earned + '/' + possible
                            + ' — grade note: ' + detail);
                    }
                    setBusy(false);
                });
            })
            .catch(function (err) {
                if (err && err.code === 'timeout') {
                    Results.renderGrade($('#score'), $('#results'), {
                        status: 'complete',
                        earned: 0,
                        possible: (exercise.grading && exercise.grading.maximum_points) || 0,
                        tests: [{
                            id: 'timeout',
                            title: 'Timeout',
                            status: 'timeout',
                            earned: 0,
                            possible: (exercise.grading && exercise.grading.maximum_points) || 0,
                            message: err.message,
                            feedback: ''
                        }]
                    });
                    setStatus('timeout', 'Timed out — restarting worker…');
                    var recovered = err.recovered || Promise.resolve();
                    recovered
                        .then(function () {
                            setStatus('ready', 'Ready again after timeout');
                        })
                        .catch(function (initErr) {
                            setStatus('worker_error', (initErr && initErr.message) || 'Restart failed');
                        })
                        .finally(function () {
                            setBusy(false);
                            updateGradeButton();
                        });
                    return;
                }
                setStatus('error', (err && err.message) || String(err));
                setBusy(false);
                updateGradeButton();
            });
    }

    function doReset() {
        if (!window.confirm('Reset to the assignment starter code? Saved work for this placement will be cleared.')) {
            return;
        }
        $('#student-source').value = starterSource();
        $('#stdin').value = defaultStdin();
        if (runtime) {
            runtime.resetRevisions();
            runtime.bumpSourceRevision();
        }
        Results.renderRunOutput($('#stdout'), $('#stderr'), { stdout: '', stderr: '' });
        Results.renderGrade($('#score'), $('#results'), null);
        clearLocalBackup();
        saveStudentSource(function () {
            setStatus('pending', 'Reset to starter code');
            updateGradeButton();
        });
        updateGradeButton();
    }

    function doLoadSolution() {
        if (!cfg.isInstructor) return;
        var sol = solutionSource();
        if (!sol) {
            setStatus('error', 'No reference solution configured');
            return;
        }
        if (!window.confirm('Load the reference solution into the editor?')) return;
        $('#student-source').value = sol;
        onEdit();
        setStatus('pending', 'Solution loaded — Run before Grade');
    }

    function renderLearner() {
        var initial = loadInitialSource();
        app.innerHTML = '';
        app.appendChild(el('section', { className: 'prompt-block' }, [
            el('h1', { text: exercise.title || 'Python exercise' }),
            el('div', { className: 'prompt', html: exercise.prompt || '' })
        ]));

        var editor = el('section', { className: 'panel' }, [
            el('h2', { text: 'Editor' }),
            el('label', { for: 'student-source', text: 'student.py' }),
            el('textarea', {
                id: 'student-source',
                className: 'code',
                rows: '14',
                spellcheck: 'false',
                'aria-label': 'Student Python source'
            }),
            el('label', { for: 'stdin', text: 'Standard input' }),
            el('textarea', {
                id: 'stdin',
                className: 'code',
                rows: '3',
                spellcheck: 'false',
                'aria-label': 'Standard input'
            }),
            el('div', { className: 'toolbar' }, [
                el('button', { type: 'button', className: 'btn btn-primary', id: 'btnRun', text: 'Run / Restart' }),
                el('button', { type: 'button', className: 'btn', id: 'btnGrade', text: 'Grade', disabled: 'disabled' }),
                el('button', { type: 'button', className: 'btn', id: 'btnReset', text: 'Reset to starter' }),
                cfg.isInstructor
                    ? el('button', { type: 'button', className: 'btn', id: 'btnSolution', text: 'Load solution' })
                    : null,
                el('span', { id: 'status', 'data-state': 'loading', 'aria-live': 'polite', text: 'Loading Python…' })
            ]),
            el('p', { id: 'dirtyNote', className: 'dirty-note' })
        ]);
        app.appendChild(editor);

        var out = el('div', { className: 'grid-2' }, [
            el('section', { className: 'panel' }, [
                el('h2', { text: 'Output' }),
                el('label', { for: 'stdout', text: 'stdout' }),
                el('pre', { id: 'stdout', className: 'output', tabindex: '0' }),
                el('label', { for: 'stderr', text: 'stderr / errors' }),
                el('pre', { id: 'stderr', className: 'output', tabindex: '0' })
            ]),
            el('section', { className: 'panel' }, [
                el('h2', { text: 'Test results' }),
                el('div', { id: 'score', className: 'score' }),
                el('div', { id: 'results' })
            ])
        ]);
        app.appendChild(out);

        $('#student-source').value = initial.source;
        $('#stdin').value = initial.stdin;
        $('#student-source').addEventListener('input', onEdit);
        $('#stdin').addEventListener('input', onEdit);
        $('#btnRun').addEventListener('click', doRun);
        $('#btnGrade').addEventListener('click', doGrade);
        $('#btnReset').addEventListener('click', doReset);
        var solBtn = $('#btnSolution');
        if (solBtn) solBtn.addEventListener('click', doLoadSolution);

        runtime = RuntimeApi.create({
            workerUrl: (cfg.urls && cfg.urls.worker) || 'worker/pyodide-worker.js',
            onStatus: function (state, msg) {
                if (state === 'loading') {
                    setStatus('loading', (msg && msg.message) || 'Loading Python…');
                } else if (state === 'ready') {
                    setStatus('ready', 'Ready'
                        + (msg && msg.pyodide_version ? ' (Pyodide ' + msg.pyodide_version + ')' : ''));
                    updateGradeButton();
                } else if (state === 'timeout') {
                    setStatus('timeout', (msg && msg.message) || 'Timed out');
                }
            }
        });

        // Start dirty until first successful Run.
        runtime.resetRevisions();
        runtime.bumpSourceRevision();
        setBusy(true);
        runtime.init().then(function () {
            setBusy(false);
            updateGradeButton();
        }).catch(function (err) {
            setStatus('worker_error', (err && err.message) || String(err));
            setBusy(false);
        });
    }

    function destroyPromptEditor() {
        if (!promptEditor) return Promise.resolve();
        var ed = promptEditor;
        promptEditor = null;
        return ed.destroy().catch(function () { /* ignore */ });
    }

    function initPromptEditor() {
        if (typeof window.ClassicEditor === 'undefined') return;
        var node = document.querySelector('#author-prompt');
        if (!node) return;
        var config = window.ClassicEditor.defaultConfig || {
            toolbar: {
                items: [
                    'heading', '|',
                    'bold', 'italic', 'link',
                    'bulletedList', 'numberedList', 'blockQuote',
                    'insertTable', 'mediaEmbed',
                    'undo', 'redo'
                ]
            }
        };
        window.ClassicEditor.create(node, config).then(function (editor) {
            promptEditor = editor;
        }).catch(function (err) {
            console.error('CKEditor init failed', err);
        });
    }

    function readPromptField() {
        if (promptEditor) {
            try {
                return promptEditor.getData();
            } catch (e) { /* fall through */ }
        }
        var ta = $('#author-prompt');
        return ta ? ta.value : '';
    }

    function setPromptField(html) {
        var value = html || '';
        if (promptEditor) {
            try {
                promptEditor.setData(value);
                return;
            } catch (e) { /* fall through */ }
        }
        var ta = $('#author-prompt');
        if (ta) ta.value = value;
    }

    function collectAuthorExercise() {
        var raw = $('#author-json').value;
        var parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            throw new Error('JSON is invalid: ' + e.message);
        }
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('Assignment JSON must be an object');
        }
        parsed.type = 'pythongrader';
        parsed.title = $('#author-title').value || parsed.title || '';
        parsed.prompt = readPromptField() || parsed.prompt || '';
        if (!parsed.files) parsed.files = {};
        if (!parsed.files['student.py']) parsed.files['student.py'] = { mode: 'editable' };
        parsed.files['student.py'].starter = $('#author-starter').value;
        parsed.files['student.py'].solution = $('#author-solution').value;
        if (!parsed.evaluation) parsed.evaluation = {};
        parsed.evaluation.source = $('#author-evaluation').value;
        if (!parsed.run) parsed.run = {};
        parsed.run.stdin = $('#author-stdin').value;
        var to = parseInt($('#author-timeout').value, 10);
        parsed.run.timeout_ms = isNaN(to) ? 5000 : to;
        parsed.builtin_rev = 'custom';
        return parsed;
    }

    function syncAuthorJsonFromFields() {
        try {
            var ex = collectAuthorExercise();
            $('#author-json').value = JSON.stringify(ex, null, 2);
        } catch (e) { /* leave JSON as-is while typing incomplete */ }
    }

    function loadAuthorFieldsFromExercise(ex) {
        exercise = ex;
        $('#author-title').value = ex.title || '';
        setPromptField(ex.prompt || '');
        var f = (ex.files && ex.files['student.py']) || {};
        $('#author-starter').value = f.starter || '';
        $('#author-solution').value = f.solution || '';
        $('#author-evaluation').value = (ex.evaluation && ex.evaluation.source) || '';
        $('#author-stdin').value = (ex.run && ex.run.stdin) || '';
        $('#author-timeout').value = String((ex.run && ex.run.timeout_ms) || 5000);
        $('#author-json').value = JSON.stringify(ex, null, 2);
        setTitle();
    }

    function saveAuthorExercise() {
        var ex;
        try {
            ex = collectAuthorExercise();
        } catch (e) {
            setStatus('error', e.message || String(e));
            return;
        }
        if (!cfg.urls || !cfg.urls.save) {
            setStatus('error', 'Save URL missing');
            return;
        }
        setStatus('pending', 'Saving…');
        fetch(cfg.urls.save, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ex)
        }).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (resp.ok && body.status === 'success') {
                    exercise = ex;
                    cfg.exercise = ex;
                    setStatus('success', 'Assignment saved');
                    setTitle();
                } else {
                    setStatus('error', body.detail || 'Save failed');
                }
            });
        }).catch(function (err) {
            setStatus('error', err.message || 'Save failed');
        });
    }

    function renderAuthor() {
        destroyPromptEditor().then(function () {
            renderAuthorBody();
        });
    }

    function renderAuthorBody() {
        app.innerHTML = '';

        var promptField = el('div', { className: 'author-prompt-field' }, [
            el('div', { className: 'field-label', text: 'Prompt / instructions' }),
            el('div', { className: 'ckeditor-container' }, [
                el('textarea', {
                    id: 'author-prompt',
                    name: 'instructions',
                    rows: '8',
                    'aria-label': 'Assignment prompt'
                })
            ])
        ]);

        app.appendChild(el('section', { className: 'panel' }, [
            el('h2', { text: 'Edit assignment' }),
            el('p', {
                className: 'dirty-note',
                text: 'Changes save to this placement only (lti_link.json). Catalog files are not modified.'
            }),
            el('div', { className: 'author-meta' }, [
                el('label', { for: 'author-title', text: 'Title' }),
                el('input', { type: 'text', id: 'author-title' }),
                promptField,
                el('label', { for: 'author-starter', text: 'Starter (student.py)' }),
                el('textarea', { id: 'author-starter', className: 'code', rows: '8' }),
                el('label', { for: 'author-solution', text: 'Solution (student.py)' }),
                el('textarea', { id: 'author-solution', className: 'code', rows: '8' }),
                el('label', { for: 'author-evaluation', text: 'Evaluation (unittest)' }),
                el('textarea', { id: 'author-evaluation', className: 'code', rows: '12' }),
                el('label', { for: 'author-stdin', text: 'Default stdin' }),
                el('textarea', { id: 'author-stdin', className: 'code', rows: '2' }),
                el('label', { for: 'author-timeout', text: 'Timeout (ms)' }),
                el('input', { type: 'number', id: 'author-timeout', min: '1000', max: '60000' }),
                el('label', { for: 'author-json', text: 'Full assignment JSON' }),
                el('textarea', { id: 'author-json', className: 'code', rows: '16' })
            ]),
            el('div', { className: 'author-actions' }, [
                el('button', { type: 'button', className: 'btn btn-primary', id: 'btnSave', text: 'Save assignment' }),
                el('button', { type: 'button', className: 'btn', id: 'btnSyncJson', text: 'Refresh JSON from fields' }),
                el('button', { type: 'button', className: 'btn', id: 'btnLoadJson', text: 'Apply JSON to fields' }),
                el('span', { id: 'status', 'data-state': '', 'aria-live': 'polite' })
            ])
        ]));

        loadAuthorFieldsFromExercise(exercise);
        initPromptEditor();

        $('#btnSave').addEventListener('click', saveAuthorExercise);
        $('#btnSyncJson').addEventListener('click', function () {
            try {
                syncAuthorJsonFromFields();
                setStatus('success', 'JSON refreshed from fields');
            } catch (e) {
                setStatus('error', e.message || String(e));
            }
        });
        $('#btnLoadJson').addEventListener('click', function () {
            try {
                var parsed = JSON.parse($('#author-json').value);
                loadAuthorFieldsFromExercise(parsed);
                setStatus('success', 'Fields loaded from JSON');
            } catch (e) {
                setStatus('error', 'Invalid JSON: ' + e.message);
            }
        });
    }

    function boot() {
        if (!app) return;
        setTitle();
        if (cfg.mode === 'author' && cfg.isInstructor) {
            renderAuthor();
        } else {
            renderLearner();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
