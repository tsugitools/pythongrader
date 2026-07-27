<?php
/**
 * PythonGrader — thin PHP shell. Behavior lives in js/ + worker/.
 */
require_once "../config.php";
require_once "assignments.php";
require_once "exercise.php";

use \Tsugi\Core\LTIX;
use \Tsugi\Core\Settings;
use \Tsugi\Util\U;
use \Tsugi\UI\SettingsForm;

$LTI = LTIX::session_start();

$oldExerciseSetting = Settings::linkGet('exercise');
if (SettingsForm::handleSettingsPost()) {
    $newExerciseSetting = Settings::linkGet('exercise');
    $assignmentChanged = $newExerciseSetting && $newExerciseSetting !== '0'
        && (string) $newExerciseSetting !== (string) $oldExerciseSetting;
    $builtin = ($newExerciseSetting && $newExerciseSetting !== '0')
        ? pythongrader_builtin_exercise($newExerciseSetting)
        : null;
    if ($builtin && isset($LINK) && $LINK && method_exists($LINK, 'setJson')) {
        $LINK->setJson(json_encode($builtin));
    }
    $redirectMode = $assignmentChanged || $builtin || U::get($_GET, 'mode') === 'author'
        ? '?mode=author'
        : '';
    header('Location: ' . addSession('index.php' . $redirectMode));
    return;
}

$_SESSION['GSRF'] = 10;
$_SESSION['RECORD_ATTEMPT_GSRF'] = 50;

$isInstructor = $USER && $USER->instructor;
$mode = U::get($_GET, 'mode', '');
if ($mode !== 'author') {
    $mode = 'learner';
}
if ($mode === 'author' && !$isInstructor) {
    $mode = 'learner';
}

$loaded = pythongrader_load_exercise(isset($LINK) ? $LINK : null);
$exercise = $loaded['exercise'];
$assignmentKey = $loaded['assignmentKey'];
$hasLink = isset($LINK) && $LINK && !empty($LINK->id);

$submission = pythongrader_load_submission(isset($RESULT) ? $RESULT : null);

$gradeSubmitUrl = addSession($CFG->wwwroot . '/api/grade-submit.php');
$recordAttemptUrl = addSession($CFG->wwwroot . '/api/record-attempt.php');
$saveUrl = addSession('save.php');
$studentSaveUrl = addSession('student-save.php');
$learnerUrl = addSession('index.php');
$authorUrl = addSession('index.php?mode=author');
$assetBust = pythongrader_asset_bust();
$persistKey = 'pythongrader-' . ($hasLink ? (string) $LINK->id : 'anon');
$workerUrl = 'worker/pyodide-worker.js?v=' . $assetBust;

$jsonFlags = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP;

$OUTPUT->suppressSiteNav();
$OUTPUT->header();
?>
<link rel="stylesheet" href="css/pythongrader.css?v=<?php echo htmlspecialchars($assetBust); ?>">
<?php
$OUTPUT->bodyStart();
$OUTPUT->flashMessages();

if ($isInstructor) {
    SettingsForm::start();
    SettingsForm::select('exercise', __('Please select an assignment'), $assignments);
    SettingsForm::dueDate();
    SettingsForm::end(/* ajax */ false);
}
?>
<header class="topbar">
    <div class="topbar-left">
        <span class="brand">PythonGrader</span>
        <span id="exerciseTitle" class="exercise-title"></span>
    </div>
    <div class="topbar-right">
<?php if ($isInstructor) : ?>
        <a class="btn btn-ghost<?php echo $mode === 'learner' ? ' pg-nav-current' : ''; ?>" href="<?php echo addSession('index.php'); ?>">Learner</a>
        <a class="btn btn-ghost<?php echo $mode === 'author' ? ' pg-nav-current' : ''; ?>" href="<?php echo addSession('index.php?mode=author'); ?>">Edit</a>
<?php endif; ?>
        <a class="btn btn-ghost" href="documentation.html" target="_blank" rel="noopener noreferrer" title="Help">Help</a>
<?php if ($isInstructor) : ?>
        <a class="btn btn-ghost" href="<?php echo addSession('grades.php'); ?>">Student Data</a>
        <a class="btn btn-ghost" href="#" <?php echo SettingsForm::attr(); ?>>Settings</a>
<?php endif; ?>
    </div>
</header>

<main id="app"></main>

<script>
window.PYTHONGRADER = {
    mode: <?php echo json_encode($mode); ?>,
    isInstructor: <?php echo $isInstructor ? 'true' : 'false'; ?>,
    hasLink: <?php echo $hasLink ? 'true' : 'false'; ?>,
    assignmentKey: <?php echo json_encode($assignmentKey); ?>,
    assignments: <?php echo json_encode($assignments); ?>,
    exercise: <?php echo json_encode($exercise, $jsonFlags); ?>,
    submission: <?php echo json_encode($submission, $jsonFlags); ?>,
    urls: {
        save: <?php echo json_encode($saveUrl); ?>,
        studentSave: <?php echo json_encode($studentSaveUrl); ?>,
        gradeSubmit: <?php echo json_encode($gradeSubmitUrl); ?>,
        recordAttempt: <?php echo json_encode($recordAttemptUrl); ?>,
        persistKey: <?php echo json_encode($persistKey); ?>,
        learner: <?php echo json_encode($learnerUrl); ?>,
        author: <?php echo json_encode($authorUrl); ?>,
        worker: <?php echo json_encode($workerUrl); ?>
    }
};
</script>
<?php if ($mode === 'author' && $isInstructor) : ?>
<script src="https://cdn.ckeditor.com/ckeditor5/16.0.0/classic/ckeditor.js"></script>
<script>
ClassicEditor.defaultConfig = {
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
</script>
<?php endif; ?>
<script src="js/runtime.js?v=<?php echo htmlspecialchars($assetBust); ?>"></script>
<script src="js/results.js?v=<?php echo htmlspecialchars($assetBust); ?>"></script>
<script src="js/pythongrader.js?v=<?php echo htmlspecialchars($assetBust); ?>"></script>
<?php
$OUTPUT->footer();
