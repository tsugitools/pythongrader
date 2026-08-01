<?php
/**
 * Built-in PythonGrader assignments.
 *
 * Select via Settings → Exercise, or on first launch with LTI custom:
 *
 *   "custom": [ { "key": "exercise", "value": "Exercise22" } ]
 *
 * Each key maps to a directory under assignments/ containing assignment.json.
 * PY4E exercises are ported from py4e/tools/pythonauto/exercises3.php.
 */

/**
 * Catalog of built-in exercises: key => label.
 */
function pythongrader_assignment_catalog() {
    return array(
        'HelloName' => 'Basics: Hello, Name',
        'Hello' => 'PY4E: Hello World',
        'Loop' => 'PY4E: Loop with range',
        'Exercise22' => 'PY4E: 2.2 Welcome Name',
        'Exercise23' => 'PY4E: 2.3 Gross Pay',
        'Exercise31' => 'PY4E: 3.1 Overtime Pay',
        'Exercise33' => 'PY4E: 3.3 Score Grade',
        'Exercise46' => 'PY4E: 4.6 computepay()',
        'Exercise52' => 'PY4E: 5.2 Largest and Smallest',
        'Exercise65' => 'PY4E: 6.5 Extract Number',
        'FileOpen' => 'PY4E: Open and Count Lines',
        'Exercise71' => 'PY4E: 7.1 File Uppercase',
        'Exercise72' => 'PY4E: 7.2 Spam Confidence',
        'Exercise84' => 'PY4E: 8.4 Unique Words',
        'Exercise85' => 'PY4E: 8.5 From Addresses',
        'Exercise94' => 'PY4E: 9.4 Most Prolific Sender',
        'Exercise102' => 'PY4E: 10.2 Hour Distribution',
        'Exercise111' => 'PY4E: 11.1 Answer to Life, the Universe and Everything',
        'Exercise119' => 'PY4E: 11.9 Regex Line Count',
    );
}

$assignments = pythongrader_assignment_catalog();

/**
 * Relative path under this tool to an assignment directory, or null.
 */
function pythongrader_builtin_relpath($key) {
    $map = array(
        'HelloName' => 'assignments/basics/hello-name',
        'Hello' => 'assignments/basics/hello',
        'Loop' => 'assignments/basics/loop',
        'Exercise22' => 'assignments/basics/exercise-2-2',
        'Exercise23' => 'assignments/basics/exercise-2-3',
        'Exercise31' => 'assignments/conditionals/exercise-3-1',
        'Exercise33' => 'assignments/conditionals/exercise-3-3',
        'Exercise46' => 'assignments/functions/exercise-4-6',
        'Exercise52' => 'assignments/loops/exercise-5-2',
        'Exercise65' => 'assignments/strings/exercise-6-5',
        'FileOpen' => 'assignments/files/file-open',
        'Exercise71' => 'assignments/files/exercise-7-1',
        'Exercise72' => 'assignments/files/exercise-7-2',
        'Exercise84' => 'assignments/lists/exercise-8-4',
        'Exercise85' => 'assignments/lists/exercise-8-5',
        'Exercise94' => 'assignments/dictionaries/exercise-9-4',
        'Exercise102' => 'assignments/tuples/exercise-10-2',
        'Exercise111' => 'assignments/regex/exercise-11-1',
        'Exercise119' => 'assignments/regex/exercise-11-9',
    );
    return isset($map[$key]) ? $map[$key] : null;
}

/**
 * Load a built-in assignment by catalog key, or null.
 */
function pythongrader_builtin_exercise($key) {
    $assignments = pythongrader_assignment_catalog();
    if (!$key || !is_string($key) || !isset($assignments[$key])) {
        return null;
    }
    if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $key)) {
        return null;
    }
    $rel = pythongrader_builtin_relpath($key);
    if (!$rel) {
        return null;
    }
    $path = __DIR__ . '/' . $rel . '/assignment.json';
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    $exercise = json_decode($raw, true);
    if (!is_array($exercise)) {
        return null;
    }
    $exercise['builtin'] = $key;
    $exercise['builtin_rev'] = md5_file($path);
    if (!isset($exercise['source']) || !is_array($exercise['source'])) {
        $exercise['source'] = array();
    }
    $exercise['source']['assignment_id'] = isset($exercise['id']) ? $exercise['id'] : $key;
    $exercise['source']['path'] = $rel . '/assignment.json';
    return $exercise;
}

/**
 * Fingerprint of a built-in assignment.json file.
 */
function pythongrader_builtin_rev($key) {
    $rel = pythongrader_builtin_relpath($key);
    if (!$rel) {
        return null;
    }
    $path = __DIR__ . '/' . $rel . '/assignment.json';
    return is_readable($path) ? md5_file($path) : null;
}
