/**
 * PythonGrader → Udemy export (browser-only ZIP via fflate).
 *
 * Phase 1 package:
 *   title.txt, learning-objective.txt, solution.py, files/<asset>,
 *   evaluation.py, instructions.html, hint.html, solution-explanation.html,
 *   starter.py, hints.md (optional), manifest.json, COMPATIBILITY.md
 *
 * Udemy coding exercises use exercise.py for learner code; PythonGrader uses
 * student.py. Evaluation source is rewritten on export accordingly.
 * Instructions, Hint, and Solution explanation are HTML for Udemy's RTEs.
 * Repository assets are fetched and offered as copy/paste fields (after solution).
 */
(function (global) {
    'use strict';

    var FORBIDDEN_IMPORT_RE = /\b(?:from\s+pythongrader|import\s+pythongrader)\b/;

    /** Udemy learner file name (PythonGrader uses student.py). */
    var UDEMY_STUDENT_FILE = 'exercise.py';
    var NATIVE_STUDENT_FILE = 'student.py';

    /**
     * Rewrite PythonGrader student.py references for Udemy's exercise.py.
     * Matches string literals and bare path mentions in evaluation source.
     */
    function toUdemyEvaluation(source) {
        if (!source) return '';
        var out = String(source);
        // Quoted path literals first, then any remaining bare filename.
        out = out.replace(/(['"])student\.py\1/g, function (m, q) {
            return q + UDEMY_STUDENT_FILE + q;
        });
        out = out.replace(/\bstudent\.py\b/g, UDEMY_STUDENT_FILE);
        return out;
    }

    function slugify(title, id) {
        var base = (title || id || 'assignment').toString().toLowerCase();
        base = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        return (base || 'assignment').slice(0, 48);
    }

    /**
     * Normalize HTML for Udemy's rich text editors
     * (instructions, hint, solution explanation).
     * Plain text is wrapped in <p>; existing HTML is left as-is (not Markdown).
     */
    function toUdemyRichTextHtml(html) {
        if (!html) return '';
        var s = String(html).replace(/\r\n?/g, '\n').trim();
        if (!s) return '';
        if (s.indexOf('<') === -1) {
            return '<p>' + escapeHtml(s) + '</p>\n';
        }
        return s + '\n';
    }

    function toUdemyInstructionsHtml(html) {
        return toUdemyRichTextHtml(html);
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    /** Keep for hints / compatibility docs that remain Markdown. */
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
            if (evaluation.indexOf(NATIVE_STUDENT_FILE) >= 0) {
                partial.push(
                    'Evaluation references to ' + NATIVE_STUDENT_FILE +
                    ' are rewritten to ' + UDEMY_STUDENT_FILE + ' for Udemy'
                );
            }
        }

        if (exercise && exercise.prompt) compatible.push('instructions');

        var objective = exercise && typeof exercise.learning_objective === 'string'
            ? exercise.learning_objective.trim() : '';
        if (objective) {
            compatible.push('learning objective');
        } else {
            partial.push('Missing learning_objective (Udemy Plan exercise field)');
        }

        var hint = exercise && typeof exercise.hint === 'string'
            ? exercise.hint.trim() : '';
        if (hint) {
            compatible.push('hint');
        } else {
            partial.push('Missing hint (Udemy learner Hint field)');
        }

        var explanation = exercise && typeof exercise.solution_explanation === 'string'
            ? exercise.solution_explanation.trim() : '';
        if (explanation) {
            compatible.push('solution explanation');
        } else {
            partial.push('Missing solution_explanation (Udemy Solution explanation field)');
        }

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
        if (assets.length) {
            compatible.push('repository assets (paste into Udemy as named files)');
            partial.push(
                'Paste each asset file into Udemy after the solution (create a file with that name)'
            );
        }

        var grading = (exercise && exercise.grading) || {};
        if (grading.partial_credit || (grading.maximum_points != null)) {
            partial.push('PythonGrader weighted points may not be preserved by Udemy');
        }

        var hints = collectHints(exercise || {});
        if (hints.length) {
            partial.push('Per-test feedback is also exported in hints.md for review');
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

    function isSafeAssetMount(mount) {
        if (!mount || typeof mount !== 'string') return false;
        mount = mount.replace(/\\/g, '/');
        if (!mount || mount.charAt(0) === '/' || mount.indexOf('..') >= 0) return false;
        return /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/.test(mount);
    }

    function assetMemberName(mount) {
        return 'files/' + String(mount).replace(/\\/g, '/');
    }

    /**
     * Fetch repository asset contents for Udemy paste/ZIP.
     * Returns Promise of [{ mount, source, text, member }].
     */
    function loadAssets(exercise) {
        var assets = (exercise && exercise.assets) || [];
        if (!assets.length) {
            return Promise.resolve([]);
        }
        return Promise.all(assets.map(function (a) {
            if (!a || !a.source || !a.mount) {
                return Promise.reject(new Error('Asset declaration missing source/mount'));
            }
            if (!isSafeAssetMount(a.mount)) {
                return Promise.reject(new Error('Invalid asset mount path: ' + a.mount));
            }
            var mount = String(a.mount).replace(/\\/g, '/');
            return fetch(a.source, { credentials: 'same-origin' }).then(function (resp) {
                if (!resp.ok) {
                    throw new Error(
                        'Missing required asset: ' + a.source + ' (' + resp.status + ')'
                    );
                }
                return resp.text().then(function (text) {
                    return {
                        mount: mount,
                        source: a.source,
                        text: text,
                        member: assetMemberName(mount)
                    };
                });
            });
        }));
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
                title: 'title.txt',
                learning_objective: 'learning-objective.txt',
                solution: 'solution.py',
                evaluation: 'evaluation.py',
                instructions: 'instructions.html',
                hint: 'hint.html',
                solution_explanation: 'solution-explanation.html',
                starter: 'starter.py'
            },
            assets: ((exercise && exercise.assets) || []).map(function (a) {
                return {
                    mount: a && a.mount,
                    source: a && a.source,
                    member: a && a.mount ? assetMemberName(a.mount) : null
                };
            }),
            title: (exercise.title || '').toString().trim(),
            learning_objective: (exercise.learning_objective || '').toString().trim(),
            hint: (exercise.hint || '').toString().trim(),
            solution_explanation: (exercise.solution_explanation || '').toString().trim(),
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
                'Udemy may require manual paste from these files.',
                'Paste order: title → learning objective → solution → asset files → … → learner file last.',
                'Create each asset in Udemy with the labeled filename, then paste its contents.',
                'Instructions, Hint, and Solution explanation are HTML for Udemy RTEs.',
                'Udemy learner code is ' + UDEMY_STUDENT_FILE +
                    '; evaluation.py is rewritten from ' + NATIVE_STUDENT_FILE + '.'
            ]
        };
    }

    /**
     * Base paste fields; asset files are inserted after solution dynamically.
     * clipboard: 'html' copies text/html for rich text editors.
     */
    var PASTE_FIELDS_BEFORE_ASSETS = [
        { file: 'title.txt', label: 'Title' },
        { file: 'learning-objective.txt', label: 'Learning objective' },
        { file: 'solution.py', label: 'Solution' }
    ];
    var PASTE_FIELDS_AFTER_ASSETS = [
        { file: 'evaluation.py', label: 'Evaluation (unittest)' },
        { file: 'instructions.html', label: 'Instructions', clipboard: 'html' },
        { file: 'hint.html', label: 'Hint', clipboard: 'html' },
        { file: 'solution-explanation.html', label: 'Solution explanation', clipboard: 'html' },
        { file: 'starter.py', label: 'Learner file' }
    ];

    function buildPasteFields(loadedAssets) {
        var fields = PASTE_FIELDS_BEFORE_ASSETS.slice();
        (loadedAssets || []).forEach(function (a) {
            fields.push({
                file: a.member,
                label: a.mount,
                asset: true
            });
        });
        return fields.concat(PASTE_FIELDS_AFTER_ASSETS);
    }

    function buildMembers(exercise, report, loadedAssets) {
        var student = (exercise.files && exercise.files['student.py']) || {};
        var members = {};
        var title = (exercise.title || '').toString().trim();
        if (title) {
            members['title.txt'] = title + '\n';
        }
        var objective = (exercise.learning_objective || '').toString().trim();
        if (objective) {
            members['learning-objective.txt'] = objective + '\n';
        }
        members['solution.py'] = student.solution || '';
        (loadedAssets || []).forEach(function (a) {
            members[a.member] = a.text;
        });
        members['evaluation.py'] = toUdemyEvaluation(
            (exercise.evaluation && exercise.evaluation.source) || ''
        );
        members['instructions.html'] = toUdemyInstructionsHtml(exercise.prompt || '');
        var hintHtml = toUdemyRichTextHtml(exercise.hint || '');
        if (hintHtml) {
            members['hint.html'] = hintHtml;
        }
        var explanationHtml = toUdemyRichTextHtml(exercise.solution_explanation || '');
        if (explanationHtml) {
            members['solution-explanation.html'] = explanationHtml;
        }
        // Learner file is last in the Udemy paste sequence.
        members['starter.py'] = student.starter || '';
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

    function buildExportPackage(exercise, loadedAssets) {
        var report = analyze(exercise);
        if (!report.ok) {
            return {
                ok: false,
                report: report,
                markdown: buildCompatibilityMarkdown(report),
                members: null,
                pasteFields: buildPasteFields(loadedAssets || []),
                memberNames: []
            };
        }
        var members = buildMembers(exercise, report, loadedAssets || []);
        var pasteFields = buildPasteFields(loadedAssets || []);
        return {
            ok: true,
            report: report,
            markdown: members['COMPATIBILITY.md'],
            members: members,
            pasteFields: pasteFields,
            memberNames: Object.keys(members)
        };
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
        return loadAssets(exercise).then(function (loadedAssets) {
            var pkg = buildExportPackage(exercise, loadedAssets);
            if (!pkg.ok) {
                return {
                    ok: false,
                    report: pkg.report,
                    markdown: pkg.markdown,
                    members: null,
                    pasteFields: pkg.pasteFields,
                    filename: null
                };
            }
            var zipBytes = zipMembers(pkg.members);
            var filename = slugify(exercise.title, exercise.id) + '-udemy.zip';
            var blob = new Blob([zipBytes], { type: 'application/zip' });
            downloadBlob(blob, filename);
            return {
                ok: true,
                report: pkg.report,
                markdown: pkg.markdown,
                members: pkg.members,
                pasteFields: pkg.pasteFields,
                filename: filename
            };
        }).catch(function (err) {
            var message = (err && err.message) || String(err);
            var report = analyze(exercise);
            report.errors = (report.errors || []).concat([message]);
            report.ok = false;
            return {
                ok: false,
                report: report,
                markdown: buildCompatibilityMarkdown(report),
                members: null,
                pasteFields: buildPasteFields([]),
                filename: null
            };
        });
    }

    function preview(exercise) {
        return loadAssets(exercise).then(function (loadedAssets) {
            return buildExportPackage(exercise, loadedAssets);
        }).catch(function (err) {
            var message = (err && err.message) || String(err);
            var report = analyze(exercise);
            report.errors = (report.errors || []).concat([message]);
            report.ok = false;
            return {
                ok: false,
                report: report,
                markdown: buildCompatibilityMarkdown(report),
                members: null,
                pasteFields: buildPasteFields([]),
                memberNames: []
            };
        });
    }

    /** Static baseline; prefer preview.pasteFields when assets are present. */
    var PASTE_FIELDS = buildPasteFields([]);

    global.PythonGraderUdemyExport = {
        analyze: analyze,
        preview: preview,
        exportZip: exportZip,
        loadAssets: loadAssets,
        buildMembers: buildMembers,
        buildPasteFields: buildPasteFields,
        buildExportPackage: buildExportPackage,
        buildCompatibilityMarkdown: buildCompatibilityMarkdown,
        htmlToMarkdown: htmlToMarkdown,
        toUdemyRichTextHtml: toUdemyRichTextHtml,
        toUdemyInstructionsHtml: toUdemyInstructionsHtml,
        toUdemyEvaluation: toUdemyEvaluation,
        slugify: slugify,
        PASTE_FIELDS: PASTE_FIELDS,
        UDEMY_STUDENT_FILE: UDEMY_STUDENT_FILE,
        NATIVE_STUDENT_FILE: NATIVE_STUDENT_FILE
    };
})(typeof window !== 'undefined' ? window : self);
