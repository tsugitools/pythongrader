/**
 * Render structured grade / run results for PythonGrader.
 */
(function (global) {
    'use strict';

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function studentFacingError(msg) {
        if (!msg) return '';
        var parts = [];
        if (msg.stderr) {
            var stderr = String(msg.stderr).trim();
            if (stderr) parts.push(stderr);
        }
        if (msg.exception) {
            var type = msg.exception.type || 'Exception';
            var message = msg.exception.message || '';
            var headline = (type + ': ' + message).trim();
            if (headline) parts.push(headline);

            var tbLines = String(msg.exception.traceback || '').split('\n');
            var keep = false;
            var loc = [];
            tbLines.forEach(function (line) {
                if (line.indexOf('  File ') === 0) {
                    keep = line.indexOf('student.py') !== -1
                        || line.indexOf('evaluation.py') !== -1;
                    if (keep) loc.push(line);
                    return;
                }
                if (keep) {
                    // Source context line under the File frame
                    if (line.indexOf('    ') === 0) loc.push(line);
                    keep = false;
                }
            });
            if (loc.length) parts.push(loc.join('\n'));
        }
        return parts.join('\n').trim();
    }

    function renderRunOutput(stdoutEl, stderrEl, msg) {
        if (stdoutEl) stdoutEl.textContent = (msg && msg.stdout) || '';
        if (!stderrEl) return;
        var text = studentFacingError(msg);
        stderrEl.textContent = text;
        var block = document.getElementById('stderr-block');
        if (block) block.hidden = !text;
    }

    function renderGrade(scoreEl, resultsEl, msg) {
        if (!scoreEl || !resultsEl) return;
        if (!msg) {
            scoreEl.textContent = '';
            resultsEl.innerHTML = '';
            return;
        }
        if (msg.status === 'grader_error') {
            scoreEl.textContent = 'Grader error';
            resultsEl.innerHTML =
                '<div class="test grader_error"><div class="test-head">Assignment / harness error</div>' +
                '<pre class="output">' + escapeHtml(msg.message || '') + '\n' +
                escapeHtml(msg.traceback || '') + '</pre></div>';
            return;
        }
        scoreEl.textContent =
            'Score: ' + (msg.earned || 0) + ' / ' + (msg.possible || 0) +
            (msg.duration_ms != null ? '  (' + msg.duration_ms + ' ms)' : '');
        resultsEl.innerHTML = (msg.tests || []).map(function (t) {
            return (
                '<div class="test ' + escapeHtml(t.status) + '">' +
                    '<div class="test-head">' +
                        '<span>' + escapeHtml(t.title || t.id) + '</span>' +
                        '<span>' + escapeHtml(String(t.status)) +
                            ' · ' + t.earned + '/' + t.possible + '</span>' +
                    '</div>' +
                    (t.group ? '<div class="test-meta">' + escapeHtml(t.group) + '</div>' : '') +
                    (t.message ? '<pre class="output">' + escapeHtml(t.message) + '</pre>' : '') +
                    (t.feedback && t.status !== 'pass'
                        ? '<div class="test-feedback">' + escapeHtml(t.feedback) + '</div>'
                        : '') +
                '</div>'
            );
        }).join('');
    }

    global.PythonGraderResults = {
        renderRunOutput: renderRunOutput,
        renderGrade: renderGrade,
        studentFacingError: studentFacingError
    };
})(typeof window !== 'undefined' ? window : self);
