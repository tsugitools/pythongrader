<?php
/**
 * Built-in PythonGrader assignments.
 *
 * Select via Settings → Exercise, or on first launch with LTI custom:
 *
 *   "custom": [ { "key": "exercise", "value": "HelloName" } ]
 *
 * Each key maps to a directory under assignments/ containing assignment.json.
 */

/**
 * Catalog of built-in exercises: key => label.
 */
function pythongrader_assignment_catalog() {
    return array(
        'HelloName' => 'Basics: Hello, Name',
    );
}

$assignments = pythongrader_assignment_catalog();

/**
 * Relative path under this tool to an assignment directory, or null.
 */
function pythongrader_builtin_relpath($key) {
    $map = array(
        'HelloName' => 'assignments/basics/hello-name',
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
