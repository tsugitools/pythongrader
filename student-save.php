<?php
/**
 * Learner endpoint: save student source into lti_result.json.
 */
require_once "../config.php";
require_once "exercise.php";

use \Tsugi\Core\LTIX;

header('Content-Type: application/json');

$LAUNCH = LTIX::requireData();

if (!$USER || !$USER->id) {
    http_response_code(403);
    echo json_encode(array('status' => 'failure', 'detail' => 'Login required'));
    return;
}

if (!$RESULT || !method_exists($RESULT, 'setJson')) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'No result context'));
    return;
}

$raw = file_get_contents('php://input');
$submission = null;
if ($raw && strlen($raw) > 0) {
    $submission = json_decode($raw, true);
}

if (!is_array($submission) || !isset($submission['files']) || !is_array($submission['files'])) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'Expected pythongrader-submission JSON with files'));
    return;
}

$payload = array(
    'schema' => 'pythongrader-submission',
    'version' => 1,
    'files' => array(
        'student.py' => isset($submission['files']['student.py'])
            ? (string) $submission['files']['student.py'] : '',
    ),
    'stdin' => isset($submission['stdin']) ? (string) $submission['stdin'] : '',
    'source_revision' => isset($submission['source_revision'])
        ? (int) $submission['source_revision'] : 0,
    'last_run_revision' => isset($submission['last_run_revision'])
        ? (int) $submission['last_run_revision'] : 0,
    'updated_at' => gmdate('c'),
);

$encoded = json_encode($payload);
if ($encoded === false || strlen($encoded) > 500000) {
    http_response_code(400);
    echo json_encode(array('status' => 'failure', 'detail' => 'Submission too large'));
    return;
}

$RESULT->setJson($encoded);
echo json_encode(array('status' => 'success'));
