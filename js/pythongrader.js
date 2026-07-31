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
    var studentEditor = null;
    var ignoreAceChange = false;

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
        var title = exercise.title || 'Python exercise';
        var t = $('#exerciseTitle');
        if (t) t.textContent = title;
        var h = $('#page-heading');
        if (h) h.textContent = 'PythonGrader: ' + title;
    }

    // Screen-reader announcements: visual #status is aria-hidden; speech goes
    // through #a11y-status (same pattern as pythonauto).
    // With ?a11y=1, also speak via speechSynthesis so you can hear without VoiceOver.
    function speakA11yDebug(msg) {
        if (!cfg.a11yDebug || !msg || typeof window.speechSynthesis === 'undefined') return;
        try {
            window.speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(msg);
            u.rate = 1.05;
            window.speechSynthesis.speak(u);
        } catch (e) { /* ignore */ }
    }

    function announceStatus(msg) {
        var el = $('#a11y-status');
        if (!el) return;
        el.textContent = '';
        setTimeout(function () {
            el.textContent = msg || '';
            speakA11yDebug(msg);
        }, 50);
    }

    function getOutputSummary(maxLen) {
        maxLen = maxLen || 280;
        var stdout = ($('#stdout') && ($('#stdout').innerText || $('#stdout').textContent)) || '';
        var text = String(stdout).replace(/\s+/g, ' ').trim();
        if (!text) return 'Your output is empty.';
        if (text.length > maxLen) text = text.substring(0, maxLen) + '…';
        return 'Your output updated. ' + text;
    }

    function getRunErrorSummary(msg, maxLen) {
        maxLen = maxLen || 280;
        var text = '';
        if (Results.studentFacingError) {
            text = Results.studentFacingError(msg);
        } else if (msg && msg.exception) {
            text = (msg.exception.type || 'Error') + ': ' + (msg.exception.message || '');
        } else if (msg && msg.stderr) {
            text = String(msg.stderr);
        }
        text = text.replace(/\s+/g, ' ').trim();
        if (!text) return 'Run finished with errors.';
        if (text.length > maxLen) text = text.substring(0, maxLen) + '…';
        return 'Run finished with errors. ' + text;
    }

    function getGradeSummary(msg) {
        if (!msg) return '';
        if (msg.status === 'grader_error') {
            return 'Grader error. ' + ((msg.message || '').replace(/\s+/g, ' ').trim());
        }
        var earned = msg.earned || 0;
        var possible = msg.possible || 0;
        var tests = msg.tests || [];
        var failed = tests.filter(function (t) {
            return t.status !== 'pass' && t.status !== 'skip';
        });
        var parts = ['Score ' + earned + ' of ' + possible + '.'];
        if (!tests.length) {
            parts.push('No tests reported.');
        } else if (!failed.length) {
            parts.push('All tests passed.');
        } else {
            parts.push(failed.length + ' test' + (failed.length === 1 ? '' : 's') + ' not passed.');
            var first = failed[0];
            parts.push('First issue: ' + (first.title || first.id || 'test') + '.');
        }
        return parts.join(' ');
    }

    function setPanelsBusy(isBusy) {
        ['stdout', 'stderr', 'results'].forEach(function (id) {
            var el = $('#' + id);
            if (!el) return;
            if (isBusy) el.setAttribute('aria-busy', 'true');
            else el.removeAttribute('aria-busy');
        });
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

    /** Show stdin only when the assignment provides default input or uses input(). */
    function needsStdin() {
        if ((defaultStdin() || '').length > 0) return true;
        return /\binput\s*\(/.test(starterSource())
            || /\binput\s*\(/.test(solutionSource());
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

    function getStudentSource() {
        if (studentEditor) return studentEditor.getValue();
        var ta = $('#student-source');
        return (ta && ta.value) || '';
    }

    function setStudentSource(code) {
        var text = code || '';
        var ta = $('#student-source');
        if (ta) ta.value = text;
        if (studentEditor) {
            ignoreAceChange = true;
            studentEditor.setValue(text, -1);
            studentEditor.clearSelection();
            studentEditor.gotoLine(1, 0, false);
            ignoreAceChange = false;
        }
    }

    function syncAceToTextarea() {
        var ta = $('#student-source');
        if (studentEditor && ta) ta.value = studentEditor.getValue();
    }

    function destroyStudentEditor() {
        if (!studentEditor) return;
        syncAceToTextarea();
        studentEditor.destroy();
        studentEditor = null;
        var host = $('#student-ace-host');
        if (host) host.remove();
        var ta = $('#student-source');
        if (ta) {
            ta.classList.remove('ace-backed');
            ta.removeAttribute('aria-hidden');
            ta.removeAttribute('tabindex');
        }
    }

    function initStudentEditor() {
        destroyStudentEditor();
        var ta = $('#student-source');
        var wrap = $('#student-editor-wrap');
        if (!ta || !wrap || typeof ace === 'undefined') return;
        if (window.matchMedia && window.matchMedia('(max-width: 480px)').matches) {
            return; // plain textarea on small screens (same as pythonauto)
        }

        var host = document.createElement('div');
        host.id = 'student-ace-host';
        host.setAttribute('role', 'presentation');
        wrap.insertBefore(host, ta);

        ta.classList.add('ace-backed');
        ta.setAttribute('aria-hidden', 'true');
        ta.setAttribute('tabindex', '-1');

        ace.config.set('basePath', 'js/vendor/ace');
        var editor = ace.edit(host);
        editor.setTheme('ace/theme/chrome');
        editor.session.setMode('ace/mode/python');
        editor.setShowPrintMargin(false);
        editor.session.setTabSize(4);
        editor.session.setUseSoftTabs(true);
        editor.session.setUseWorker(false);
        editor.setOptions({
            fontSize: '16px',
            fontFamily: 'Courier, monospace',
            showLineNumbers: true,
            highlightActiveLine: true,
            behavioursEnabled: true,
            wrap: false
        });
        editor.setValue(ta.value || '', -1);
        editor.clearSelection();
        editor.gotoLine(1, 0, false);
        editor.session.on('change', function () {
            if (ignoreAceChange) return;
            syncAceToTextarea();
            onEdit();
        });
        try {
            var aceInput = editor.textInput && editor.textInput.getElement
                ? editor.textInput.getElement()
                : null;
            if (aceInput) {
                aceInput.setAttribute('aria-label', 'Python code editor');
            }
        } catch (e) { /* ignore */ }

        studentEditor = editor;
        editor.resize();
    }

    function buildSubmissionPayload() {
        return {
            schema: 'pythongrader-submission',
            version: 1,
            files: {
                'student.py': getStudentSource()
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
        var fallbackStdin = defaultStdin();
        var stdin = fallbackStdin;
        var fromServer = false;
        var sub = cfg.submission;
        if (sub && sub.files && typeof sub.files['student.py'] === 'string') {
            source = sub.files['student.py'];
            if (typeof sub.stdin === 'string') stdin = sub.stdin;
            fromServer = true;
        } else {
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
        }
        // Empty saved stdin should not hide the assignment's default (e.g. Sarah).
        if (!(stdin || '').length && (fallbackStdin || '').length) {
            stdin = fallbackStdin;
        }
        return { source: source, stdin: stdin, fromServer: fromServer };
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

    function setStatus(state, text, announceMsg) {
        var s = $('#status');
        var msg = text || state || '';
        if (s) {
            s.dataset.state = state || '';
            s.textContent = msg;
        }
        // Optional richer SR message; default to the visible status text.
        announceStatus(announceMsg != null ? announceMsg : msg);
    }

    function autosizeTextarea(ta) {
        if (!ta) return;
        ta.style.height = '0px';
        var max = Math.floor(window.innerHeight * 0.4);
        var next = Math.max(ta.scrollHeight, 36);
        ta.style.height = Math.min(next, max) + 'px';
    }

    function setBusy(isBusy) {
        busy = !!isBusy;
        var run = $('#btnRun');
        var grade = $('#btnGrade');
        if (run) run.disabled = busy || !(runtime && runtime.isReady());
        updateGradeButton();
        if (busy && grade) grade.disabled = true;
        setPanelsBusy(busy);
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
        if (!getStudentSource().trim()) {
            setStatus('fail', 'You do not have any Python code.');
            return;
        }
        setBusy(true);
        setStatus('running', 'Running…', 'Running your code.');
        Results.renderGrade($('#score'), $('#results'), null);
        runtime
            .run(
                getStudentSource(),
                ($('#stdin') && $('#stdin').value) || '',
                timeoutMs(),
                exercise.assets || []
            )
            .then(function (msg) {
                Results.renderRunOutput($('#stdout'), $('#stderr'), msg);
                var visual = 'Run complete (' + (msg.duration_ms || 0) + ' ms)';
                var hasErr = !!(msg && ((msg.stderr && String(msg.stderr).trim()) || msg.exception));
                setStatus(
                    hasErr ? 'fail' : 'complete',
                    visual,
                    hasErr ? getRunErrorSummary(msg) : ('Execution complete. ' + getOutputSummary())
                );
                scheduleAutosave();
                setBusy(false);
            })
            .catch(function (err) {
                if (err && err.code === 'timeout') {
                    Results.renderRunOutput($('#stdout'), $('#stderr'), {
                        stdout: '',
                        stderr: err.message
                    });
                    setStatus(
                        'timeout',
                        'Timed out — restarting worker…',
                        'Timed out. ' + getOutputSummary() + ' Restarting worker.'
                    );
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
                setStatus(
                    'worker_error',
                    'Run failed',
                    'Error running code. ' + getOutputSummary()
                );
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
        setStatus('running', 'Grading…', 'Grading your code.');
        runtime
            .grade(
                getStudentSource(),
                evaluationSource(),
                testMetadata(),
                exercise.grading || {},
                timeoutMs(),
                exercise.assets || []
            )
            .then(function (msg) {
                // Keep the last Run stdout/stderr — grade harness output is mocked
                // and would blank the learner's exploratory run output.
                if (msg.status === 'grader_error') {
                    var priorOut = ($('#stdout') && $('#stdout').textContent) || '';
                    Results.renderRunOutput($('#stdout'), $('#stderr'), {
                        stdout: priorOut,
                        stderr: msg.message || 'Grader error'
                    });
                }
                Results.renderGrade($('#score'), $('#results'), msg);
                var gradeSpeech = getGradeSummary(msg);

                if (msg.status === 'grader_error') {
                    setStatus('grader_error', 'Grader error', gradeSpeech);
                    setBusy(false);
                    return;
                }

                var possible = msg.possible || 0;
                var earned = msg.earned || 0;
                var grade = possible > 0 ? earned / possible : 0;

                if (!cfg.hasLink || !cfg.urls || !cfg.urls.gradeSubmit) {
                    setStatus(
                        'success',
                        'Score: ' + earned + '/' + possible + ' (not submitted — no LTI placement)',
                        gradeSpeech + ' Grade not submitted — no LTI placement.'
                    );
                    setBusy(false);
                    return;
                }

                setStatus('pending', 'Submitting grade…');
                recordAttempt();
                saveStudentSource(null);
                return submitGrade(grade).then(function (resp) {
                    if (resp.ok || (resp.body && resp.body.status === 'success')) {
                        setStatus(
                            'success',
                            'Grade submitted: ' + earned + '/' + possible,
                            'Grade updated on server. ' + gradeSpeech
                        );
                    } else {
                        var detail = (resp.body && (resp.body.detail || resp.body.status)) || 'submit failed';
                        setStatus(
                            'success',
                            'Scored ' + earned + '/' + possible + ' — grade note: ' + detail,
                            gradeSpeech + ' Error storing grade on server: ' + detail
                        );
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
                    setStatus(
                        'timeout',
                        'Timed out — restarting worker…',
                        'Grading timed out. Restarting worker.'
                    );
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
        setStudentSource(starterSource());
        var stdinReset = $('#stdin');
        if (stdinReset) {
            stdinReset.value = defaultStdin();
            autosizeTextarea(stdinReset);
        }
        if (runtime) {
            runtime.resetRevisions();
            runtime.bumpSourceRevision();
        }
        Results.renderRunOutput($('#stdout'), $('#stderr'), { stdout: '', stderr: '' });
        Results.renderGrade($('#score'), $('#results'), null);
        clearLocalBackup();
        saveStudentSource(function () {
            setStatus(
                'pending',
                'Reset to starter code',
                'Code reset to the assignment starter.'
            );
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
        setStudentSource(sol);
        onEdit();
        setStatus(
            'pending',
            'Solution loaded — Run before Grade',
            'Reference solution loaded into the editor. Run before grading.'
        );
    }

    function renderLearner() {
        var initial = loadInitialSource();
        app.innerHTML = '';

        var left = el('div', { className: 'learner-left' }, [
            el('section', {
                className: 'prompt-block',
                role: 'region',
                'aria-label': 'Assignment instructions'
            }, [
                el('div', { className: 'prompt', id: 'exercise-prompt', html: exercise.prompt || '' })
            ]),
            el('div', { className: 'toolbar', role: 'toolbar', 'aria-label': 'Code actions' }, [
                el('button', { type: 'button', className: 'btn btn-primary', id: 'btnRun', text: 'Run / Restart' }),
                el('button', { type: 'button', className: 'btn', id: 'btnGrade', text: 'Grade', disabled: 'disabled' }),
                el('button', { type: 'button', className: 'btn', id: 'btnReset', text: 'Reset' }),
                cfg.isInstructor
                    ? el('button', { type: 'button', className: 'btn', id: 'btnSolution', text: 'Load solution' })
                    : null,
                solutionSource().trim()
                    ? el('button', {
                        type: 'button',
                        className: 'btn btn-sparkle',
                        id: 'btnParsons',
                        title: 'Study code fragments',
                        'aria-label': 'Study code fragments'
                    })
                    : null,
                // Visual status only — SR announcements go through #a11y-status
                el('span', {
                    id: 'status',
                    'data-state': 'loading',
                    'aria-hidden': 'true',
                    text: 'Loading Python…'
                })
            ]),
            el('p', { id: 'dirtyNote', className: 'dirty-note', 'aria-live': 'polite' }),
            el('div', { className: 'student-editor-wrap', id: 'student-editor-wrap' }, [
                el('textarea', {
                    id: 'student-source',
                    className: 'code student-source',
                    rows: '18',
                    spellcheck: 'false',
                    'aria-label': 'Python code editor'
                })
            ])
        ]);

        var showStdin = needsStdin();
        var right = el('div', { className: 'learner-right' }, [
            showStdin
                ? el('section', { className: 'panel panel-stdin' }, [
                    el('label', { for: 'stdin', id: 'stdin-label', text: 'Standard Input (stdin)' }),
                    el('textarea', {
                        id: 'stdin',
                        className: 'code stdin-autosize',
                        rows: '1',
                        spellcheck: 'false',
                        'aria-labelledby': 'stdin-label'
                    })
                ])
                : null,
            el('section', {
                className: 'panel',
                role: 'region',
                'aria-labelledby': 'stdout-label'
            }, [
                el('label', { for: 'stdout', id: 'stdout-label', text: 'Standard Output (stdout)' }),
                el('pre', {
                    id: 'stdout',
                    className: 'output',
                    tabindex: '0',
                    role: 'region',
                    'aria-labelledby': 'stdout-label'
                }),
                el('div', { id: 'stderr-block', hidden: 'hidden' }, [
                    el('label', { for: 'stderr', id: 'stderr-label', text: 'Standard Error (stderr)' }),
                    el('pre', {
                        id: 'stderr',
                        className: 'output',
                        tabindex: '0',
                        role: 'region',
                        'aria-labelledby': 'stderr-label'
                    })
                ])
            ]),
            el('section', {
                className: 'panel',
                role: 'region',
                'aria-labelledby': 'results-heading'
            }, [
                el('h2', { id: 'results-heading', text: 'Test results' }),
                el('div', { id: 'score', className: 'score', 'aria-live': 'off' }),
                el('div', { id: 'results', tabindex: '0' })
            ])
        ]);

        app.appendChild(el('div', { className: 'learner-layout' }, [left, right]));

        setStudentSource(initial.source);
        initStudentEditor();
        var stdinEl = $('#stdin');
        if (stdinEl) {
            stdinEl.value = initial.stdin;
            autosizeTextarea(stdinEl);
            stdinEl.addEventListener('input', function () {
                autosizeTextarea(stdinEl);
                onEdit();
            });
        }
        $('#student-source').addEventListener('input', onEdit);
        $('#btnRun').addEventListener('click', doRun);
        $('#btnGrade').addEventListener('click', doGrade);
        $('#btnReset').addEventListener('click', doReset);
        var solBtn = $('#btnSolution');
        if (solBtn) solBtn.addEventListener('click', doLoadSolution);
        var parsonsBtn = $('#btnParsons');
        if (parsonsBtn) {
            var sparkle = document.createElement('img');
            sparkle.src = 'static/sparkle.png';
            sparkle.alt = '';
            sparkle.setAttribute('aria-hidden', 'true');
            parsonsBtn.appendChild(sparkle);
            parsonsBtn.addEventListener('click', function () {
                if (typeof window.showParsonsHint === 'function') {
                    window.showParsonsHint();
                }
            });
        }
        window.addEventListener('resize', function () {
            if (studentEditor) studentEditor.resize();
        });

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

    function currentAuthorExercise() {
        // Prefer live fields (including CKEditor) over stale JSON textarea.
        syncAuthorJsonFromFields();
        return collectAuthorExercise();
    }

    function copyTextToClipboard(text, btn) {
        var done = function (ok) {
            if (!btn) return;
            var prev = btn.textContent;
            btn.textContent = ok ? 'Copied' : 'Copy failed';
            setTimeout(function () {
                btn.textContent = prev;
            }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                done(true);
            }).catch(function () {
                done(false);
            });
            return;
        }
        // Fallback for older browsers
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (e) {
            ok = false;
        }
        ta.remove();
        done(ok);
    }

    function renderUdemyPasteFields(host, members) {
        var Export = window.PythonGraderUdemyExport;
        var fields = (Export && Export.PASTE_FIELDS) || [];
        var wrap = el('div', { className: 'udemy-paste', id: 'udemy-paste' });
        wrap.appendChild(el('h4', { text: 'Copy into Udemy' }));
        wrap.appendChild(el('p', {
            className: 'udemy-paste-help',
            text: 'Paste each field into the matching Udemy coding-exercise box. No ZIP extraction needed.'
        }));

        fields.forEach(function (field) {
            if (!members || typeof members[field.file] !== 'string') return;
            var text = members[field.file];
            var section = el('section', { className: 'udemy-paste-field' });
            var head = el('div', { className: 'udemy-paste-head' });
            head.appendChild(el('h5', { text: field.label + ' (' + field.file + ')' }));
            var btnCopy = el('button', {
                type: 'button',
                className: 'btn btn-primary',
                text: 'Copy'
            });
            btnCopy.addEventListener('click', function () {
                copyTextToClipboard(text, btnCopy);
            });
            head.appendChild(btnCopy);
            section.appendChild(head);
            section.appendChild(el('textarea', {
                className: 'code udemy-paste-text',
                rows: String(Math.min(16, Math.max(4, text.split('\n').length + 1))),
                readonly: 'readonly',
                spellcheck: 'false',
                'aria-label': field.label
            }));
            wrap.appendChild(section);
            // Set value after append (el() uses attributes, not .value for content)
            var ta = section.querySelector('textarea');
            if (ta) ta.value = text;
        });

        host.appendChild(wrap);
    }

    function renderUdemyPanel(preview) {
        var host = $('#udemy-panel');
        if (!host) return;
        host.hidden = false;
        host.innerHTML = '';
        host.appendChild(el('h3', {
            text: preview.ok ? 'Udemy export — compatible' : 'Udemy export — not exportable'
        }));
        host.appendChild(el('pre', { text: preview.markdown || '' }));

        var actions = el('div', { className: 'udemy-actions' });
        var btnPaste = el('button', {
            type: 'button',
            className: 'btn btn-primary',
            id: 'btnUdemyPaste',
            text: 'Show copy/paste fields'
        });
        var btnDl = el('button', {
            type: 'button',
            className: 'btn',
            id: 'btnUdemyDownload',
            text: 'Download ZIP'
        });
        if (!preview.ok) {
            btnPaste.disabled = true;
            btnDl.disabled = true;
        }
        var btnClose = el('button', {
            type: 'button',
            className: 'btn',
            text: 'Close'
        });
        actions.appendChild(btnPaste);
        actions.appendChild(btnDl);
        actions.appendChild(btnClose);
        host.appendChild(actions);

        btnClose.addEventListener('click', function () {
            host.hidden = true;
            host.innerHTML = '';
        });
        btnDl.addEventListener('click', function () {
            authorDownloadUdemyZip();
        });
        btnPaste.addEventListener('click', function () {
            var existing = $('#udemy-paste');
            if (existing) {
                existing.hidden = !existing.hidden;
                btnPaste.textContent = existing.hidden
                    ? 'Show copy/paste fields'
                    : 'Hide copy/paste fields';
                return;
            }
            if (!preview.members) {
                setStatus('error', 'No paste fields available');
                return;
            }
            renderUdemyPasteFields(host, preview.members);
            btnPaste.textContent = 'Hide copy/paste fields';
            setStatus('success', 'Copy each field into Udemy');
        });

        // Compatible exports: open paste fields by default (ZIP still available).
        if (preview.ok && preview.members) {
            renderUdemyPasteFields(host, preview.members);
            btnPaste.textContent = 'Hide copy/paste fields';
        }
    }

    function authorExportUdemyPreview() {
        var Export = window.PythonGraderUdemyExport;
        if (!Export) {
            setStatus('error', 'Udemy export module not loaded');
            return;
        }
        var next;
        try {
            next = currentAuthorExercise();
        } catch (e) {
            setStatus('error', e.message || String(e));
            return;
        }
        setStatus('pending', 'Checking Udemy compatibility…');
        var preview = Export.preview(next);
        renderUdemyPanel(preview);
        if (preview.ok) {
            setStatus('success', 'Compatible — copy fields into Udemy, or download ZIP');
        } else {
            setStatus('error', 'Not exportable — see Udemy export panel');
        }
    }

    function authorDownloadUdemyZip() {
        var Export = window.PythonGraderUdemyExport;
        if (!Export) {
            setStatus('error', 'Udemy export module not loaded');
            return;
        }
        if (!window.fflate) {
            setStatus('error', 'ZIP library (fflate) not loaded');
            return;
        }
        var next;
        try {
            next = currentAuthorExercise();
        } catch (e) {
            setStatus('error', e.message || String(e));
            return;
        }
        setStatus('pending', 'Building Udemy ZIP…');
        try {
            var result = Export.exportZip(next);
            renderUdemyPanel({
                ok: result.ok,
                markdown: result.markdown,
                report: result.report,
                members: result.members || null
            });
            if (result.ok) {
                setStatus('success', 'Downloaded ' + result.filename);
            } else {
                setStatus('error', 'Not exportable — see Udemy export panel');
            }
        } catch (err) {
            setStatus('error', (err && err.message) || String(err));
        }
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
                el('button', { type: 'button', className: 'btn', id: 'btnUdemyExport', text: 'Export to Udemy' }),
                el('span', { id: 'status', 'data-state': '', 'aria-live': 'polite' })
            ]),
            el('div', { id: 'udemy-panel', className: 'udemy-panel', hidden: true })
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
        $('#btnUdemyExport').addEventListener('click', authorExportUdemyPreview);
    }

    function boot() {
        if (!app) return;
        if (cfg.a11yDebug) {
            document.body.classList.add('a11y-debug');
        }
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
