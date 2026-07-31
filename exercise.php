<?php
/**
 * Assignment defaults, built-in catalog resolution, and first-launch preload.
 *
 * Priority when loading a placement:
 *   1. Built-in key via Settings::linkDefaultConfigurationFromLaunch (Settings / LTI custom / ?exercise=)
 *   2. Valid assignment already in lti_link.json
 *   3. Full assignment via Autograder::loadCustomConfig (custom_config / ?inherit= / ?exercise= as rlid)
 *   4. Empty stub
 */

require_once __DIR__ . '/assignments.php';

use \Tsugi\Core\Settings;
use \Tsugi\Util\U;
use \Tsugi\Util\Autograder;

/**
 * Cache-bust token for main-thread JS/CSS.
 */
function pythongrader_asset_bust() {
    static $bust = null;
    if ($bust !== null) {
        return $bust;
    }
    $files = array(
        __DIR__ . '/js/pythongrader.js',
        __DIR__ . '/js/runtime.js',
        __DIR__ . '/js/results.js',
        __DIR__ . '/js/udemy-export.js',
        __DIR__ . '/js/vendor/fflate.min.js',
        __DIR__ . '/js/vendor/ace/ace.js',
        __DIR__ . '/js/vendor/ace/mode-python.js',
        __DIR__ . '/js/vendor/ace/theme-chrome.js',
        __DIR__ . '/worker/pyodide-worker.js',
        __DIR__ . '/worker/harness.py',
        __DIR__ . '/worker/result.py',
        __DIR__ . '/css/pythongrader.css',
    );
    $parts = array();
    foreach ($files as $path) {
        $parts[] = is_readable($path) ? md5_file($path) : '';
    }
    $bust = substr(md5(implode('|', $parts)), 0, 12);
    return $bust;
}

/**
 * Empty assignment when nothing is configured yet.
 */
function pythongrader_empty_exercise() {
    return array(
        'type' => 'pythongrader',
        'schema_version' => 1,
        'id' => 'empty',
        'assignment_version' => 1,
        'title' => '',
        'prompt' => '<p>No assignment configured yet. Instructors: open Settings and choose an assignment, or use Edit to author one.</p>',
        'files' => array(
            'student.py' => array(
                'mode' => 'editable',
                'starter' => "# Write your Python program here\n",
                'solution' => '',
            ),
        ),
        'run' => array(
            'stdin' => '',
            'timeout_ms' => 5000,
        ),
        'evaluation' => array(
            'filename' => 'evaluation.py',
            'source' => "import unittest\n\nclass PlaceholderTests(unittest.TestCase):\n    def test_todo(self):\n        self.fail('No tests configured yet')\n",
            'tests' => array(),
        ),
        'assets' => array(),
        'packages' => array(),
        'grading' => array(
            'maximum_points' => 0,
            'partial_credit' => true,
        ),
    );
}

/**
 * True if decoded array looks like a PythonGrader assignment.
 */
function pythongrader_is_valid_exercise($decoded) {
    return is_array($decoded)
        && isset($decoded['type'])
        && $decoded['type'] === 'pythongrader'
        && isset($decoded['prompt'], $decoded['files']);
}

/**
 * Decode a JSON string into an assignment array, or null.
 */
function pythongrader_decode_exercise_json($raw) {
    if (!$raw || !is_string($raw) || U::isEmpty($raw)) {
        return null;
    }
    $decoded = json_decode($raw, true);
    if (pythongrader_is_valid_exercise($decoded)) {
        return $decoded;
    }
    return null;
}

/**
 * Load assignment from link JSON; else custom config; else built-in; else empty.
 *
 * @return array{exercise: array, assignmentKey: ?string}
 */
function pythongrader_load_exercise($LINK) {
    $assignmentKey = Settings::linkDefaultConfigurationFromLaunch(
        'exercise',
        array_keys(pythongrader_assignment_catalog())
    );

    $raw = null;
    if ($LINK && method_exists($LINK, 'getJson')) {
        $raw = $LINK->getJson();
    }
    $existing = pythongrader_decode_exercise_json($raw);

    if ($assignmentKey) {
        $builtin = pythongrader_builtin_exercise($assignmentKey);
        if ($builtin) {
            $jsonBuiltin = (is_array($existing) && isset($existing['builtin']))
                ? $existing['builtin']
                : null;
            $jsonRev = (is_array($existing) && isset($existing['builtin_rev']))
                ? $existing['builtin_rev']
                : null;
            $fileRev = isset($builtin['builtin_rev']) ? $builtin['builtin_rev'] : null;
            $isCustom = ($jsonRev === 'custom');
            $stale = !$isCustom && $fileRev && $jsonRev !== $fileRev;
            if (!$existing || $jsonBuiltin !== $assignmentKey || $stale) {
                if ($LINK && method_exists($LINK, 'setJson') && !empty($LINK->id)) {
                    $LINK->setJson(json_encode($builtin));
                }
                return array(
                    'exercise' => $builtin,
                    'assignmentKey' => $assignmentKey,
                );
            }
            return array(
                'exercise' => $existing,
                'assignmentKey' => $assignmentKey,
            );
        }
    }

    if ($existing) {
        return array(
            'exercise' => $existing,
            'assignmentKey' => $assignmentKey,
        );
    }

    $fromCustom = Autograder::loadCustomConfig('pythongrader_is_valid_exercise');
    if ($fromCustom) {
        if ($LINK && method_exists($LINK, 'setJson') && !empty($LINK->id)) {
            $LINK->setJson(json_encode($fromCustom));
        }
        return array(
            'exercise' => $fromCustom,
            'assignmentKey' => $assignmentKey,
        );
    }

    return array(
        'exercise' => pythongrader_empty_exercise(),
        'assignmentKey' => $assignmentKey,
    );
}

/**
 * Decode a student submission from result JSON, or null.
 */
function pythongrader_decode_submission($raw) {
    if (!$raw || !is_string($raw) || U::isEmpty($raw)) {
        return null;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return null;
    }
    if (isset($decoded['schema']) && $decoded['schema'] === 'pythongrader-submission'
        && isset($decoded['files']) && is_array($decoded['files'])) {
        return $decoded;
    }
    if (isset($decoded['pythongrader_submission']) && is_array($decoded['pythongrader_submission'])) {
        $sub = $decoded['pythongrader_submission'];
        if (isset($sub['files']) && is_array($sub['files'])) {
            return $sub;
        }
    }
    return null;
}

/**
 * Load current learner submission from RESULT JSON.
 */
function pythongrader_load_submission($RESULT) {
    if (!$RESULT || !method_exists($RESULT, 'getJson')) {
        return null;
    }
    return pythongrader_decode_submission($RESULT->getJson());
}
