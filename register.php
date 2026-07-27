<?php

require_once __DIR__ . '/assignments.php';

$REGISTER_LTI2 = array(
    "name" => "PythonGrader",
    "FontAwesome" => "fa-code",
    "short_name" => "PythonGrader",
    "description" => "Interactive Python autograder using in-browser Pyodide. Learners edit Python, run with stdin, and are graded with ordinary unittest.",
    "messages" => array("launch", "launch_grade"),
    "targets" => array("window", "iframe"),
    "privacy_level" => "name_only",
    "license" => "Apache",
    "languages" => array(
        "English",
    ),
    "source_url" => "https://github.com/tsugitools/pythongrader",
    "placements" => array(
    ),
    "custom" => array(
        "exercise" => pythongrader_assignment_catalog(),
    ),
);
