/**
 * Parsons "Code Fragments" modal — study-only drag-and-drop reorder.
 * Uses window.ParsonsBlocks + solution from PYTHONGRADER / solutionSource.
 */
(function () {
    'use strict';

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderBlock(text, index) {
        var lines = escapeHtml(text).split('\n');
        var html = '';
        for (var i = 0; i < lines.length; i++) {
            if (i > 0) html += '<br>';
            html += lines[i];
        }
        return '<div class="parsons-block">' +
            '<span class="parsons-block-num">' + (index + 1) + '</span>' +
            '<span class="parsons-drag-grip" aria-hidden="true">&#8942;</span>' +
            '<div class="parsons-block-code">' + html + '</div>' +
            '</div>';
    }

    function renumberParsonsBlocks() {
        if (typeof window.jQuery === 'undefined') return;
        window.jQuery('#parsons-blocks .parsons-block').each(function (i) {
            window.jQuery(this).find('.parsons-block-num').text(i + 1);
        });
    }

    function destroyParsonsSortable() {
        if (typeof window.jQuery === 'undefined') return;
        var $container = window.jQuery('#parsons-blocks');
        if ($container.hasClass('ui-sortable')) {
            $container.sortable('destroy');
        }
    }

    function initParsonsSortable() {
        if (typeof window.jQuery === 'undefined' || !window.jQuery.fn.sortable) return;
        destroyParsonsSortable();
        window.jQuery('#parsons-blocks').sortable({
            axis: 'y',
            cursor: 'move',
            tolerance: 'pointer',
            placeholder: 'parsons-block parsons-block-placeholder',
            forcePlaceholderSize: true,
            update: renumberParsonsBlocks
        });
    }

    function getSolutionCode() {
        var cfg = window.PYTHONGRADER || {};
        var files = cfg.exercise && cfg.exercise.files && cfg.exercise.files['student.py'];
        if (files && typeof files.solution === 'string' && files.solution.trim()) {
            return files.solution;
        }
        return '';
    }

    function getParsonsSeed() {
        var cfg = window.PYTHONGRADER || {};
        if (typeof cfg.parsonsSeed === 'number') return cfg.parsonsSeed >>> 0;
        return 1;
    }

    window.showParsonsHint = function () {
        if (!window.ParsonsBlocks) {
            alert('Code fragments module is not loaded.');
            return false;
        }
        var code = getSolutionCode();
        if (!code) {
            alert('No example fragments are available for this exercise.');
            return false;
        }
        var scrambled = window.ParsonsBlocks.makeScrambledParsonsBlocks(code, getParsonsSeed());
        if (!scrambled.length) {
            alert('No example fragments are available for this exercise.');
            return false;
        }
        var html = '';
        for (var i = 0; i < scrambled.length; i++) {
            html += renderBlock(scrambled[i], i);
        }
        destroyParsonsSortable();
        var host = document.getElementById('parsons-blocks');
        if (!host) return false;
        host.innerHTML = html;
        initParsonsSortable();
        if (typeof window.jQuery !== 'undefined' && window.jQuery.fn.modal) {
            window.jQuery('#parsons-hint').modal('show');
        } else {
            var modal = document.getElementById('parsons-hint');
            if (modal) modal.style.display = 'block';
        }
        return false;
    };

    function resetParsonsModalPosition() {
        if (typeof window.jQuery === 'undefined') return;
        var $dialog = window.jQuery('#parsons-hint .modal-dialog');
        $dialog.css({ top: '', left: '', margin: '' });
        $dialog.removeData('parsons-drag-ready');
    }

    function initParsonsModalDraggable() {
        if (typeof window.jQuery === 'undefined' || !window.jQuery.fn.draggable) return;
        var $modal = window.jQuery('#parsons-hint');
        if (!$modal.length) return;
        $modal.on('shown.bs.modal', function () {
            var $dialog = $modal.find('.modal-dialog');
            if (!$dialog.data('ui-draggable')) {
                $dialog.draggable({
                    handle: '.modal-header',
                    containment: 'window',
                    scroll: false,
                    start: function () {
                        if (!window.jQuery(this).data('parsons-drag-ready')) {
                            window.jQuery(this).css('margin', 0);
                            window.jQuery(this).data('parsons-drag-ready', true);
                        }
                    }
                });
            }
            var closeBtn = document.querySelector('#parsons-hint .close');
            if (closeBtn) closeBtn.focus();
        });
        $modal.on('hidden.bs.modal', function () {
            resetParsonsModalPosition();
            var opener = document.getElementById('btnParsons');
            if (opener) opener.focus();
        });
    }

    window.initParsonsHintGuards = function () {
        var modal = document.getElementById('parsons-hint');
        if (!modal) return;
        function blockCopy(e) {
            e.preventDefault();
        }
        modal.addEventListener('copy', blockCopy);
        modal.addEventListener('cut', blockCopy);
        modal.addEventListener('contextmenu', blockCopy);
        modal.addEventListener('selectstart', blockCopy);
        initParsonsModalDraggable();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initParsonsHintGuards);
    } else {
        window.initParsonsHintGuards();
    }
}());
