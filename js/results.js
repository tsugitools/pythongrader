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

    function renderRunOutput(stdoutEl, stderrEl, msg) {
        if (stdoutEl) stdoutEl.textContent = (msg && msg.stdout) || '';
        if (!stderrEl) return;
        var parts = [];
        if (msg && msg.stderr) parts.push(msg.stderr);
        if (msg && msg.exception) {
            parts.push(
                (msg.exception.type || 'Exception') + ': ' + (msg.exception.message || '')
            );
            if (msg.exception.traceback) parts.push(msg.exception.traceback);
        }
        stderrEl.textContent = parts.join('\n');
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
        renderGrade: renderGrade
    };
})(typeof window !== 'undefined' ? window : self);
