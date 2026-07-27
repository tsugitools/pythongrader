/**
 * PythonGrader → Udemy export (browser-only ZIP via fflate).
 *
 * Phase 1 package:
 *   starter.py, solution.py, evaluation.py, instructions.md,
 *   solution-explanation.md, hints.md (optional), manifest.json, COMPATIBILITY.md
 */
(function (global) {
    'use strict';

    var FORBIDDEN_IMPORT_RE = /\b(?:from\s+pythongrader|import\s+pythongrader)\b/;

    function slugify(title, id) {
        var base = (title || id || 'assignment').toString().toLowerCase();
        base = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return (base || 'assignment').slice(0, 48);
    }

    function htmlToMarkdown(html) {
        if (!html) return '';
        var s = String(html);
        s = s.replace(/\r\n?/g, '\n');
        s = s.replace(/<\s*br\s*\/?>/gi, '\n');
        s = s.replace(/<\s*\/\s*p\s*>/gi, '\n\n');
        s = s.replace(/<\s*p[^>]*>/gi, '');
        s = s.replace(/<\s*h([1-6])[^>]*>([\s\S]*?)<\s*\/\s*h\1\s*>/gi, function (_, level, inner) {
            return '\n' + '#'.repeat(parseInt(level, 10)) + ' ' + stripTags(inner).trim() + '\n\n';
        });
        s = s.replace(/<\s*li[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi, function (_, inner) {
            return '- ' + stripTags(inner).trim() + '\n';
        });
        s = s.replace(/<\s*\/?\s*ul[^>]*>/gi, '\n');
        s = s.replace(/<\s*\/?\s*ol[^>]*>/gi, '\n');
        s = s.replace(/<\s*pre[^>]*>([\s\S]*?)<\s*\/\s*pre\s*>/gi, function (_, inner) {
            return '\n```\n' + decodeEntities(stripTags(inner)).replace(/\n$/, '') + '\n```\n\n';
        });
        s = s.replace(/<\s*code[^>]*>([\s\S]*?)<\s*\/\s*code\s*>/gi, function (_, inner) {
            return '`' + stripTags(inner) + '`';
        });
        s = s.replace(/<\s*a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, function (_, href, inner) {
            return '[' + stripTags(inner).trim() + '](' + href + ')';
        });
        s = s.replace(/<\s*b[^>]*>([\s\S]*?)<\s*\/\s*b\s*>/gi, '**$1**');
        s = s.replace(/<\s*strong[^>]*>([\s\S]*?)<\s*\/\s*strong\s*>/gi, '**$1**');
        s = s.replace(/<\s*i[^>]*>([\s\S]*?)<\s*\/\s*i\s*>/gi, '*$1*');
        s = s.replace(/<\s*em[^>]*>([\s\S]*?)<\s*\/\s*em\s*>/gi, '*$1*');
        s = stripTags(s);
        s = decodeEntities(s);
        s = s.replace(/\n{3,}/g, '\n\n').trim();
        return s;
    }

    function stripTags(s) {
        return String(s).replace(/<[^>]+>/g, '');
    }

    function decodeEntities(s) {
        return String(s)
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    function collectHints(exercise) {
        var hints = [];
        var tests = (exercise.evaluation && exercise.evaluation.tests) || {};
        Object.keys(tests).forEach(function (id) {
            var t = tests[id] || {};
            if (Array.isArray(t.hints)) {
                t.hints.forEach(function (h) {
                    if (h) hints.push({ test: id, text: String(h) });
                });
            }
            if (t.feedback) {
                hints.push({ test: id, text: String(t.feedback) });
            }
        });
        return hints;
    }

    function analyze(exercise) {
        var compatible = [];
        var partial = [];
        var unsupported = [];
        var errors = [];

        if (!exercise || exercise.type !== 'pythongrader') {
            errors.push('type must be pythongrader');
        }

        var student = exercise && exercise.files && exercise.files['student.py'];
        var starter = student && typeof student.starter === 'string' ? student.starter : '';
        var solution = student && typeof student.solution === 'string' ? student.solution : '';
        var evaluation = exercise && exercise.evaluation && typeof exercise.evaluation.source === 'string'
            ? exercise.evaluation.source : '';

        if (!starter.trim()) errors.push('Missing starter (student.py)');
        else compatible.push('starter.py');

        if (!solution.trim()) errors.push('Missing solution (student.py)');
        else compatible.push('solution.py');

        if (!evaluation.trim()) errors.push('Missing evaluation source');
        else if (FORBIDDEN_IMPORT_RE.test(evaluation)) {
            unsupported.push('evaluation imports PythonGrader-only modules');
            errors.push('Evaluation uses PythonGrader-only imports');
        } else {
            compatible.push('unittest evaluation');
            if (evaluation.indexOf('unittest.mock') >= 0 || evaluation.indexOf('from unittest.mock') >= 0) {
                compatible.push('unittest.mock.patch');
            }
        }

        if (exercise && exercise.prompt) compatible.push('instructions');

        var fileKeys = exercise && exercise.files ? Object.keys(exercise.files) : [];
        if (fileKeys.length > 1 || (fileKeys.length === 1 && fileKeys[0] !== 'student.py')) {
            unsupported.push('Multiple student files (only student.py is supported)');
            errors.push('Multiple student files are not supported for Udemy export');
        }

        var packages = (exercise && exercise.packages) || [];
        if (packages.length) {
            unsupported.push('packages: ' + packages.map(function (p) {
                return (p && p.name) || String(p);
            }).join(', '));
            errors.push('Non-empty packages are not supported for Udemy export');
        }

        var assets = (exercise && exercise.assets) || [];
        assets.forEach(function (a) {
            var label = (a && (a.source || a.mount)) || 'asset';
            unsupported.push('Repository asset: ' + label);
        });
        if (assets.length) {
            errors.push('Repository assets are not supported in Phase 1 Udemy export');
        }

        var grading = (exercise && exercise.grading) || {};
        if (grading.partial_credit || (grading.maximum_points != null)) {
            partial.push('PythonGrader weighted points may not be preserved by Udemy');
        }

        var hints = collectHints(exercise || {});
        if (hints.length) {
            partial.push('Progressive hints / feedback are exported as a separate document');
        }

        if (exercise && exercise.exports && exercise.exports.udemy
            && exercise.exports.udemy.enabled === false) {
            errors.push('Udemy export is disabled for this assignment');
        }

        return {
            compatible: compatible,
            partial: partial,
            unsupported: unsupported,
            errors: errors,
            ok: errors.length === 0,
            hints: hints
        };
    }

    function buildCompatibilityMarkdown(report) {
        var lines = ['# Udemy compatibility', ''];
        if (report.compatible.length) {
            lines.push('## COMPATIBLE', '');
            report.compatible.forEach(function (item) {
                lines.push('✓ ' + item);
            });
            lines.push('');
        }
        if (report.partial.length) {
            lines.push('## PARTIAL', '');
            report.partial.forEach(function (item) {
                lines.push('~ ' + item);
            });
            lines.push('');
        }
        if (report.unsupported.length) {
            lines.push('## UNSUPPORTED', '');
            report.unsupported.forEach(function (item) {
                lines.push('✗ ' + item);
            });
            lines.push('');
        }
        if (report.errors.length) {
            lines.push('## BLOCKING ERRORS', '');
            report.errors.forEach(function (item) {
                lines.push('- ' + item);
            });
            lines.push('');
        }
        return lines.join('\n').trim() + '\n';
    }

    function buildManifest(exercise, report) {
        var tests = (exercise.evaluation && exercise.evaluation.tests) || {};
        var testList = Object.keys(tests).map(function (id) {
            var t = tests[id] || {};
            return {
                id: id,
                title: t.title || id,
                group: t.group || '',
                points: typeof t.points === 'number' ? t.points : 0,
                feedback: t.feedback || ''
            };
        });
        return {
            format: 'pythongrader-udemy-export',
            schema_version: 1,
            source: {
                type: 'pythongrader',
                id: exercise.id || '',
                title: exercise.title || '',
                assignment_version: exercise.assignment_version || 1,
                builtin: exercise.builtin || null
            },
            files: {
                starter: 'starter.py',
                solution: 'solution.py',
                evaluation: 'evaluation.py',
                instructions: 'instructions.md'
            },
            grading: exercise.grading || {},
            tests: testList,
            compatibility: {
                ok: report.ok,
                compatible: report.compatible,
                partial: report.partial,
                unsupported: report.unsupported,
                errors: report.errors
            },
            notes: [
                'Generated entirely in the browser by PythonGrader.',
                'Udemy may require manual paste from these files.'
            ]
        };
    }

    function buildMembers(exercise, report) {
        var student = (exercise.files && exercise.files['student.py']) || {};
        var members = {};
        members['starter.py'] = student.starter || '';
        members['solution.py'] = student.solution || '';
        members['evaluation.py'] = (exercise.evaluation && exercise.evaluation.source) || '';
        members['instructions.md'] = htmlToMarkdown(exercise.prompt || '');
        if (exercise.solution_explanation) {
            members['solution-explanation.md'] = String(exercise.solution_explanation).trim() + '\n';
        }
        if (report.hints && report.hints.length) {
            var hintLines = ['# Hints and feedback', ''];
            report.hints.forEach(function (h) {
                hintLines.push('- **' + h.test + '**: ' + h.text);
            });
            hintLines.push('');
            members['hints.md'] = hintLines.join('\n');
        }
        members['manifest.json'] = JSON.stringify(buildManifest(exercise, report), null, 2) + '\n';
        members['COMPATIBILITY.md'] = buildCompatibilityMarkdown(report);
        return members;
    }

    function zipMembers(members) {
        if (!global.fflate || typeof global.fflate.zipSync !== 'function') {
            throw new Error('fflate is not loaded');
        }
        var strToU8 = global.fflate.strToU8;
        var input = {};
        Object.keys(members).forEach(function (name) {
            input[name] = strToU8(String(members[name]));
        });
        return global.fflate.zipSync(input, { level: 6 });
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function exportZip(exercise) {
        var report = analyze(exercise);
        if (!report.ok) {
            return {
                ok: false,
                report: report,
                markdown: buildCompatibilityMarkdown(report),
                members: null,
                filename: null
            };
        }
        var members = buildMembers(exercise, report);
        var zipBytes = zipMembers(members);
        var filename = slugify(exercise.title, exercise.id) + '-udemy.zip';
        var blob = new Blob([zipBytes], { type: 'application/zip' });
        downloadBlob(blob, filename);
        return {
            ok: true,
            report: report,
            markdown: members['COMPATIBILITY.md'],
            members: members,
            filename: filename
        };
    }

    function preview(exercise) {
        var report = analyze(exercise);
        return {
            ok: report.ok,
            report: report,
            markdown: buildCompatibilityMarkdown(report),
            members: report.ok ? Object.keys(buildMembers(exercise, report)) : []
        };
    }

    global.PythonGraderUdemyExport = {
        analyze: analyze,
        preview: preview,
        exportZip: exportZip,
        buildMembers: buildMembers,
        buildCompatibilityMarkdown: buildCompatibilityMarkdown,
        htmlToMarkdown: htmlToMarkdown,
        slugify: slugify
    };
})(typeof window !== 'undefined' ? window : self);
