# PythonGrader Design

PythonGrader is a Tsugi tool for introductory Python exercises that run and grade entirely in the browser. It uses Pyodide in a Web Worker, ordinary Python `unittest` evaluation files, and the existing Tsugi attempt, grade, and LTI infrastructure.

PythonGrader is the Python sibling of [WebGrader](https://github.com/tsugitools/webgrader) and DBGrader. It follows their useful conventions without trying to share their runtime internals.

This document is intentionally implementation-oriented. The first version should be small, understandable, and useful before more ambitious authoring features are added.

## Core principle

> PythonGrader is the rich authoring and learning environment. Udemy is a deliberately limited export target.

The grader is designed to help students learn, not to conceal tests or solutions. All execution, tests, assets, and reference material may be inspected by a determined learner. In a world where an AI can produce a solution immediately, fast and precise feedback is more valuable than artificial secrecy.

## Goals

- Run real Python in the browser with no server-side code execution.
- Support a fast **Edit → Run → Grade** learner loop.
- Use ordinary `unittest`, including `unittest.mock.patch`, rather than inventing a new assertion language.
- Capture standard output, standard error, exceptions, tracebacks, and test results.
- Return structured per-test results suitable for partial credit and targeted feedback.
- Stop runaway student programs by terminating their Web Worker.
- Store the complete assignment definition in the existing Tsugi placement JSON field.
- Store a curated built-in assignment catalog as JSON under `assignments/`.
- Keep assignment assets in the repository at stable paths and detect missing required assets.
- Reuse existing Tsugi autosave, attempts, grades, student-data views, and LTI passback.
- Allow instructors to author and test assignments in PythonGrader.
- Produce a Phase 1 Udemy export ZIP entirely in browser memory.
- Leave room for AI-assisted assignment authoring without making AI a Phase 1 dependency.

## Non-goals

PythonGrader will not initially:

- execute Python on the application server;
- provide a secure examination environment;
- hide downloaded tests, solutions, or assets;
- support arbitrary native Python packages;
- emulate operating-system processes, sockets, or unrestricted networking;
- provide a terminal, debugger, notebook, or full cloud IDE;
- support interactive `input()` prompts that pause execution while awaiting a student response;
- guarantee compatibility with every CPython package or behavior;
- translate every native PythonGrader feature to Udemy;
- upload directly to Udemy or depend on an undocumented Udemy API;
- use AI to grade student work;
- share a generalized runtime framework with WebGrader or DBGrader.

The browser is an educational execution environment, not a hostile-code sandbox.

## Relationship to WebGrader and DBGrader

PythonGrader should reuse conventions, not implementation:

- thin PHP entry points;
- one complete assignment object in `lti_link.json`;
- student source in `lti_result.json`;
- built-in assignments under `assignments/`;
- instructor **Edit** mode and learner mode;
- exploratory **Run** separated from scored **Grade**;
- dirty-state protection so Grade never evaluates stale code;
- existing Tsugi attempt recording and grade passback;
- JSON import/export;
- compatibility analysis before Udemy export;
- stable repository asset paths.

The Pyodide worker, virtual filesystem, Python test harness, and result protocol are specific to PythonGrader.

## Learner experience

The basic page contains:

- assignment title and instructions;
- one Python editor in Phase 1;
- optional standard-input textarea;
- **Run / Restart** button;
- **Grade** button;
- **Reset to starter** button;
- output panel with `stdout`, `stderr`, and runtime errors;
- structured test-results panel;
- instructor-only **Load solution** action.

The learner workflow is:

1. Edit `student.py`.
2. Optionally enter the complete standard input for this run.
3. Press **Run / Restart**.
4. Inspect output or correct a syntax/runtime error.
5. Press **Grade**.
6. Inspect individual test results, points, and feedback.
7. Revise and repeat.

`input()` consumes lines from the standard-input textarea. It does not display a live prompt and wait for new input. When the supplied input is exhausted, the runtime raises `EOFError`, as a redirected command-line program would.

## Source lifecycle

```text
Edit source or stdin  → DIRTY
Run / Restart         → RUNNING and CLEAN
Grade                 → tests the current clean source
Edit again            → DIRTY; Grade disabled
Timeout               → worker terminated; DIRTY
```

Implementation sketch:

```javascript
sourceRevision += 1;              // source or stdin changed
runningRevision = sourceRevision; // successful Run
canGrade = runningRevision === sourceRevision;
```

Grade must never silently run an older revision.

## High-level architecture

```text
Tsugi gradable placement
        |
        | lti_link.json (assignment)
        | lti_result.json (student source and stdin)
        v
Thin PHP shell
        |
        | window.PYTHON_GRADER bootstrap data
        v
Browser application
        |
        +-- editor, instructions, output, results
        +-- autosave and grade submission
        |
        +-- Pyodide Web Worker
                |
                +-- isolated working directory
                +-- student.py
                +-- evaluation.py
                +-- assignment assets
                +-- Python test harness
                |
                v
        structured JSON messages
```

PHP must never evaluate student Python. It serves assignment data and assets, saves student work, records attempts, and returns grades through existing Tsugi mechanisms.

## Repository layout

```text
pythongrader/
├── DESIGN.md
├── README.md
├── index.php
├── register.php
├── tsugi.php
├── exercise.php
├── save.php
├── student-save.php
├── grades.php
├── grade-detail.php
├── assignments.php
├── css/
│   └── pythongrader.css
├── js/
│   ├── pythongrader.js       # learner and author UI
│   ├── runtime.js            # worker lifecycle and message protocol
│   ├── validation.js         # assignment validation
│   ├── results.js            # result rendering
│   ├── udemy-export.js       # compatibility analysis and package members
│   └── vendor/
│       └── fflate.min.js     # pinned browser ZIP implementation
├── worker/
│   ├── pyodide-worker.js
│   ├── harness.py
│   └── result.py
├── assignments/
│   ├── basics/
│   │   └── hello-name/
│   │       └── assignment.json
│   ├── conditionals/
│   ├── loops/
│   ├── functions/
│   ├── strings/
│   ├── files/
│   │   └── count-lines/
│   │       ├── assignment.json
│   │       └── assets/
│   │           └── words.txt
│   └── data-structures/
├── tests/
│   ├── assignment-validation/
│   ├── worker/
│   └── udemy-export/
└── scripts/
    └── validate-assignments.mjs
```

The exact PHP filenames may follow the existing WebGrader tool more closely during implementation. The separation of responsibilities matters more than the spelling of individual files.

## Assignment storage

The complete assignment is one versioned JSON object. A built-in catalog file is copied into `lti_link.json` when selected for a placement. Editing the placement changes its copy and does not mutate the catalog file.

Student source and the most recent standard input are stored in `lti_result.json`. Attempt details use existing Tsugi attempt storage.

## Assignment JSON

### Phase 1 example

```json
{
  "type": "pythongrader",
  "schema_version": 1,
  "id": "basics-hello-name-001",
  "assignment_version": 1,
  "title": "Hello, Name",
  "prompt": "<p>Read a name and print <code>Hello NAME</code>.</p>",
  "learning_objective": "Prompt for a name with input() and print a greeting that includes that name.",
  "hint": "Store the result of input() in a variable, then pass both 'Hello' and that variable to print().",
  "files": {
    "student.py": {
      "mode": "editable",
      "starter": "name = input('Enter your name: ')\n# Print the greeting\n",
      "solution": "name = input('Enter your name: ')\nprint('Hello', name)\n"
    }
  },
  "run": {
    "stdin": "Chuck\n",
    "timeout_ms": 5000
  },
  "evaluation": {
    "filename": "evaluation.py",
    "source": "import io\nimport runpy\nimport unittest\nfrom unittest.mock import patch\n\nclass HelloNameTests(unittest.TestCase):\n    def run_student(self, name):\n        output = io.StringIO()\n        with patch('builtins.input', return_value=name):\n            with patch('sys.stdout', output):\n                runpy.run_path('student.py', run_name='__main__')\n        return output.getvalue().strip()\n\n    def test_chuck(self):\n        self.assertEqual(self.run_student('Chuck'), 'Hello Chuck')\n\n    def test_ada(self):\n        self.assertEqual(self.run_student('Ada'), 'Hello Ada')\n",
    "tests": {
      "HelloNameTests.test_chuck": {
        "title": "Greets Chuck",
        "group": "Basic behavior",
        "points": 5,
        "feedback": "Read the name and include it in the printed greeting.",
        "hints": [
          "Pass both strings to print().",
          "The expected output is: Hello Chuck"
        ]
      },
      "HelloNameTests.test_ada": {
        "title": "Works with another name",
        "group": "General behavior",
        "points": 5,
        "feedback": "Do not hard-code the example name."
      }
    }
  },
  "assets": [],
  "packages": [],
  "grading": {
    "maximum_points": 10,
    "partial_credit": true
  },
  "solution_explanation": "The program reads one string and passes it to print with the greeting.",
  "exports": {
    "udemy": {
      "enabled": true
    }
  }
}
```

### Design rules

- `type` must be `pythongrader`.
- `schema_version` changes only when the assignment format changes incompatibly.
- `assignment_version` changes when the specific exercise changes.
- Phase 1 has exactly one editable file named `student.py`.
- Starter, solution, and evaluation source are stored inline so one JSON object remains the source of truth.
- The evaluation source is ordinary Python using the standard library.
- Test metadata is separate from Python source and keyed by full unittest test ID.
- Test points must sum to `grading.maximum_points`.
- Unknown test IDs, duplicate IDs, negative points, and a points mismatch are authoring errors.
- `packages` must be empty in Phase 1.
- `timeout_ms` has a conservative minimum and maximum enforced by the application.

Keeping point values and learner feedback in JSON allows the Python tests to remain normal `unittest` tests that can also run outside the browser.

## Why `unittest`

`unittest` is already part of Python and Pyodide. The following require no extra packages:

```python
import sys
import io
import unittest
from unittest.mock import patch
```

Ordinary `unittest` provides:

- familiar authoring;
- easy AI generation;
- assertions and useful failure messages;
- `setUp()` and `tearDown()`;
- mocking of `input()`, `stdout`, functions, and objects;
- straightforward execution outside PythonGrader;
- a plausible path to Udemy export.

Phase 1 deliberately does not require `pytest`.

## Pyodide runtime

### Loading

Pyodide is loaded from one pinned version. Production should serve the pinned distribution from a stable Tsugi static location rather than requesting “latest” from a CDN.

The application displays separate states:

```text
Loading Python → Ready → Running → Complete
                           |
                           +→ Timed out / worker replaced
```

The first load may be noticeably slower than later runs. The UI must show honest loading progress and must not enable Run or Grade until the worker is ready.

### Worker requirement

Pyodide always runs inside a Web Worker. Running arbitrary learner Python on the main UI thread is not acceptable because an infinite loop would freeze the entire page.

The parent owns the timeout:

1. Send a run request with a unique request ID.
2. Start a timer.
3. Accept only messages with the current request ID.
4. On timeout, terminate the worker.
5. Report a timeout to the learner.
6. Create and initialize a replacement worker.

Python cannot reliably interrupt every runaway program from inside the same interpreter. Worker termination is the hard stop.

### Worker reuse

Normal runs may reuse a warm Pyodide worker to avoid repeated downloads, but every execution gets a clean working directory and clean Python module state.

After a timeout, internal worker error, or failed reset, the worker is discarded and rebuilt.

Correctness is more important than preserving a warm interpreter. If cleanup proves fragile, Phase 1 may use one fresh worker per Run or Grade after the Pyodide files are browser-cached.

### Virtual filesystem

Each execution uses a private directory such as:

```text
/home/pyodide/work/
├── student.py
├── evaluation.py
└── assets/
    └── words.txt
```

Before execution, the worker:

1. removes or replaces the previous work directory;
2. writes the current student source;
3. writes the evaluation source for Grade;
4. writes all declared assets;
5. sets the current working directory;
6. prepends the working directory to `sys.path`;
7. invalidates import caches;
8. captures output;
9. runs the requested operation.

Assignment filenames and mount paths are validated. Absolute paths, `..`, empty path components, and collisions with reserved grader files are rejected.

## Run operation

Run executes `student.py` as `__main__` with:

- the configured or learner-entered standard input;
- captured `stdout`;
- captured `stderr`;
- a bounded timeout;
- a clean working directory;
- assignment assets in place.

The result message is structured:

```json
{
  "protocol_version": 1,
  "request_id": "run-42",
  "operation": "run",
  "status": "complete",
  "stdout": "Hello Chuck\n",
  "stderr": "",
  "exception": null,
  "duration_ms": 18
}
```

Syntax errors and runtime exceptions return type, message, and a sanitized traceback. Internal Pyodide and grader failures are reported separately from student failures.

## Grade operation

Grade writes both `student.py` and `evaluation.py`, imports the evaluation module, discovers its tests, and runs them with a custom `unittest.TestResult` subclass.

JavaScript must not parse the human-readable output of `TextTestRunner`. The Python harness directly creates JSON-safe result objects.

Example:

```json
{
  "protocol_version": 1,
  "request_id": "grade-43",
  "operation": "grade",
  "status": "complete",
  "earned": 5,
  "possible": 10,
  "duration_ms": 31,
  "tests": [
    {
      "id": "HelloNameTests.test_chuck",
      "title": "Greets Chuck",
      "group": "Basic behavior",
      "status": "pass",
      "earned": 5,
      "possible": 5,
      "message": "",
      "traceback": "",
      "duration_ms": 2
    },
    {
      "id": "HelloNameTests.test_ada",
      "title": "Works with another name",
      "group": "General behavior",
      "status": "fail",
      "earned": 0,
      "possible": 5,
      "message": "'Hello Chuck' != 'Hello Ada'",
      "traceback": "...",
      "duration_ms": 1
    }
  ]
}
```

Supported statuses:

- `pass`;
- `fail` for assertion failures;
- `error` for exceptions in student code or a test;
- `skip` for an explicitly skipped test;
- `timeout` when the entire worker is terminated;
- `grader_error` for invalid evaluation code, metadata mismatch, or harness failure.

An instructor or grader configuration error must never be presented as a student assertion failure.

## Test isolation

Tests frequently import or execute `student.py` more than once. The grader should provide documented examples for both patterns:

### Whole-program testing

```python
import io
import runpy
from unittest.mock import patch

output = io.StringIO()
with patch("builtins.input", return_value="Chuck"):
    with patch("sys.stdout", output):
        runpy.run_path("student.py", run_name="__main__")
```

### Function testing

```python
import importlib.util

spec = importlib.util.spec_from_file_location("student_case", "student.py")
student = importlib.util.module_from_spec(spec)
spec.loader.exec_module(student)

self.assertEqual(student.add(2, 3), 5)
```

The Phase 1 harness should not attempt magical per-test process isolation. Evaluation authors are responsible for fresh imports or `runpy` when a test needs clean module state. Later, PythonGrader may provide a tiny documented helper module if repeated patterns become painful, but native tests should not depend on it until Udemy export consequences are understood.

## Standard input and output

For **Run**, the worker replaces `sys.stdin` with an `io.StringIO` containing the complete supplied input. Normal prompt text written by `input("Prompt: ")` appears in captured output as it would in a terminal.

For **Grade**, evaluation code normally uses `unittest.mock.patch` to control `input()` and `sys.stdout`. The outer harness separately captures unclaimed output so debugging noise can be displayed without corrupting the JSON protocol.

`unittest.TextTestRunner` writes to `stderr` by default. PythonGrader does not depend on that text stream because its custom result object records outcomes directly.

## Assets

Assignment assets live in the repository beneath the assignment:

```text
assignments/files/count-lines/
├── assignment.json
└── assets/
    └── words.txt
```

Example declaration:

```json
{
  "assets": [
    {
      "source": "assignments/files/count-lines/assets/words.txt",
      "mount": "assets/words.txt",
      "required": true
    }
  ]
}
```

Rules:

- assets are read from the checked-out repository;
- asset paths are relative to the repository root;
- required assets are validated when a catalog assignment is loaded, edited, graded, and exported;
- missing required assets block grading and show an instructor-facing configuration error;
- repository asset paths are treated as stable public API;
- old assets are not deleted merely because a newer assignment revision stops using them;
- a changed asset that would alter an old assignment should receive a new filename;
- Phase 1 supports reasonably sized text and binary assets;
- the browser fetches each asset and writes its bytes to Pyodide's filesystem;
- an optional checksum may be added later if accidental replacement becomes a real problem.

Student-created output files exist only in the worker filesystem for that execution. Phase 1 may display a small list of created filenames, but it need not provide a full file browser.

## Packages

Phase 1 supports the Python standard library included in the pinned Pyodide distribution and declares:

```json
"packages": []
```

Later package support may distinguish:

```json
{
  "packages": [
    {
      "name": "numpy",
      "loader": "pyodide"
    },
    {
      "name": "some-pure-python-package",
      "version": "1.2.3",
      "loader": "micropip"
    }
  ]
}
```

Rules for later phases:

- versions are pinned;
- packages load before student execution;
- package-loading failures are grader errors;
- unsupported native extensions are rejected during author validation;
- packages are cached by the browser when practical;
- assignment compatibility reports list package requirements;
- Udemy export warns or fails when the target cannot provide the same package.

Package support should be added only after the standard-library grader is solid.

## Assignment catalog

`assignments.php` maps stable catalog keys to JSON paths, following WebGrader:

```php
'HelloName' => 'assignments/basics/hello-name/assignment.json'
```

The catalog provides human-readable categories and titles. Selecting a built-in copies its JSON into the current placement. Existing placements therefore remain stable when the catalog assignment later changes.

The repository validator checks every catalog entry for:

- readable and valid JSON;
- supported schema version;
- unique assignment ID;
- valid starter, solution, and evaluation source;
- matching test IDs;
- correct point totals;
- safe filenames;
- available required assets;
- permitted timeout;
- permitted packages;
- valid Udemy export declaration.

## Authoring interface

Phase 1 authoring should be practical, not elaborate:

- title and rich-text prompt;
- starter-code editor;
- solution-code editor;
- evaluation-code editor;
- test metadata editor or complete JSON editor;
- default stdin and timeout;
- asset declarations;
- **Run starter**;
- **Run solution**;
- **Grade starter**;
- **Grade solution**;
- full JSON view, copy, import, and export;
- **Export to Udemy** compatibility preview and ZIP download.

Before saving or exporting, author validation should require:

- the solution loads without syntax/runtime errors where applicable;
- the solution passes every test;
- the starter differs from the solution;
- the starter fails at least one test unless explicitly allowed;
- every discovered test has metadata;
- every metadata entry names a discovered test;
- point totals match;
- required assets exist.

Starter validation is important: a technically valid export is not useful when the starter already passes everything.

## Feedback and progressive reveal

Tests are inspectable, so reveal controls are pedagogical rather than security controls.

Phase 1 displays:

- test title;
- group;
- pass/fail/error status;
- earned and possible points;
- assertion message;
- instructor feedback.

Phase 2 may add a sequence:

1. conceptual hint;
2. specific hint;
3. test input and expected result;
4. relevant test source;
5. reference solution.

Reveal state may be recorded for learning analytics, but it does not change the score unless an assignment explicitly says so.

## Grading policy

- Score is `earned / maximum_points`.
- Passing a test earns all of its points.
- Failing, erroring, or timing out earns zero for that test.
- Skipped-test policy is declared by the assignment; the default is zero.
- Phase 1 does not subdivide points within one test.
- The attempt record includes the structured result summary and current source.
- Existing Tsugi policy determines whether the current, highest, or latest score becomes the course grade.
- LTI passback receives a value from 0.0 through 1.0.

## Autosave and recovery

Student source and standard input are:

- debounced to `student-save.php`;
- backed up in `localStorage`;
- restored carefully when server and local versions differ;
- saved again when Grade is pressed.

Evaluation code and solutions are never included in student autosave data.

## Worker message protocol

Messages are versioned and contain:

```json
{
  "protocol_version": 1,
  "request_id": "grade-43",
  "operation": "grade",
  "payload": {}
}
```

The worker replies with `loading`, `ready`, `running`, `complete`, or `worker_error`. Large binary assets are transferred as `ArrayBuffer` objects when possible.

The browser ignores stale responses from a terminated or superseded request.

## Security and trust model

- Student code runs only in the browser.
- The application server never executes submitted Python.
- Tests and solutions cannot be kept secret from a determined learner.
- Worker termination protects UI responsiveness, not the learner's browser from every possible browser vulnerability.
- Pyodide and ZIP dependencies are pinned.
- Remote network access from Python is unavailable by default.
- Assignment asset paths are allow-listed by the assignment and validated.
- The worker receives only the data needed for the current exercise.
- Output and tracebacks are size-limited before display or storage.
- Attempt payloads and student source remain subject to normal Tsugi authorization and CSRF protections.

The design does not claim high-stakes exam security.

## Udemy export

### Principle

PythonGrader remains authoritative. Udemy export is a lossy compiler with an explicit compatibility report.

The exporter must never silently omit unsupported behavior.

### Phase 1 interface

In instructor Edit mode:

1. Click **Export to Udemy**.
2. Review compatibility results.
3. Download `hello-name-udemy.zip`.

The ZIP is assembled entirely in browser memory using a pinned browser ZIP library. It is downloaded with a `Blob` and object URL. Generated members are not written to the application server, a build directory, or a temporary file.

Conceptually:

```javascript
const members = buildUdemyMembers(assignment);
const zipBytes = zipSync(members);
const blob = new Blob([zipBytes], { type: "application/zip" });
downloadBlob(blob, "hello-name-udemy.zip");
```

### Phase 1 ZIP

```text
hello-name-udemy.zip
├── learning-objective.txt
├── solution.py
├── evaluation.py
├── instructions.html
├── starter.py
├── hint.html
├── solution-explanation.html
├── manifest.json
└── COMPATIBILITY.md
```

`hints.md` may still be included in the ZIP when per-test feedback exists (review aid only; not a Udemy paste field). Compatible small assets may be included later after the exact Udemy target behavior is verified. Phase 1 reports native assets as unsupported rather than pretending they work.

These are reviewable authoring files. If Udemy requires manual paste rather than ZIP import, the ZIP still provides a convenient single download and clear file separation. Paste order matches Udemy authoring and ends with Hint, then Solution explanation. `learning-objective.txt` is plain text; `instructions.html`, `hint.html`, and `solution-explanation.html` are HTML for Udemy's rich text editors.

### Translation rules

Phase 1 export is intentionally conservative:

- `student.py` starter becomes `starter.py`;
- `student.py` solution becomes `solution.py`;
- ordinary standard-library evaluation source becomes `evaluation.py`;
- evaluation references to `student.py` are rewritten to Udemy's learner file `exercise.py`;
- `learning_objective` becomes `learning-objective.txt` for Udemy's Plan-exercise field;
- `hint` is exported as `hint.html` for Udemy's rich text Hint field (plain text wrapped in `<p>`);
- prompt HTML is exported as `instructions.html` for Udemy's rich text editor;
- `solution_explanation` is exported last as `solution-explanation.html` for Udemy's rich text field;
- per-test feedback may still appear in optional `hints.md` for review;
- PythonGrader point weights remain documented in the manifest;
- the exporter reports when Udemy will not preserve native weighting or feedback;
- PythonGrader-only helper imports are forbidden in Phase 1 evaluation code;
- packages, multiple student files, and assets are unsupported until verified.

Udemy coding exercises execute learner code as `exercise.py`. PythonGrader keeps `student.py` as the native editable file. Built-in evaluations prefer whichever of those files exists so the same unittest source can grade in both environments; the exporter still rewrites hardcoded `student.py` paths for hand-authored tests.

### Compatibility levels

Every feature is classified:

- `COMPATIBLE` — translated without a known semantic loss;
- `PARTIAL` — usable, with a documented difference;
- `UNSUPPORTED` — blocks export or is explicitly omitted;
- `NOT_APPLICABLE`.

Example report:

```text
COMPATIBLE
✓ starter.py
✓ solution.py
✓ unittest evaluation
✓ unittest.mock.patch
✓ instructions

PARTIAL
~ PythonGrader weighted points may not be preserved by Udemy
~ Progressive hints are exported as a separate document

UNSUPPORTED
✗ Repository asset: assignments/files/count-lines/assets/words.txt
```

Unknown features are `UNSUPPORTED`, never implicitly compatible.

### Export validation

Before producing a ZIP:

1. Validate the assignment schema.
2. Confirm the starter, solution, and evaluation exist.
3. Confirm required repository assets exist, even if Udemy cannot use them.
4. Grade the solution and require every test to pass.
5. Grade the starter and normally require at least one failure.
6. Scan for known PythonGrader-only dependencies.
7. Build the compatibility report.
8. Produce ZIP bytes only when there are no blocking errors.

Golden-file tests should compare generated package members for representative assignments. The exporter should also be verified manually against a live Udemy Python coding exercise before its compatibility claims are broadened.

## AI-assisted authoring

AI assistance belongs after the deterministic authoring and validation loop works.

Possible later actions:

- draft a starter from a learning objective;
- draft a reference solution;
- generate ordinary `unittest` cases;
- identify missing edge cases;
- generate test metadata, hints, and explanations;
- repair a failing solution/test mismatch;
- suggest a simpler assignment;
- explain Udemy incompatibilities and propose compatible alternatives.

AI output is always a draft. The same deterministic checks apply:

- solution passes;
- starter fails at least one test;
- points match;
- tests are discoverable;
- assets exist;
- export compatibility is explicit.

The assignment JSON remains the source of truth, not the AI conversation.

## Error categories

Errors should be visibly categorized:

- **Student syntax error** — invalid `student.py`.
- **Student runtime error** — exception while running student code.
- **Test failure** — assertion did not match.
- **Test error** — student behavior caused an exception during a test.
- **Timeout** — worker was terminated.
- **Assignment error** — invalid JSON, metadata mismatch, missing asset, or point mismatch.
- **Runtime error** — Pyodide or worker failed.
- **Export error** — target conversion cannot be completed.

This distinction prevents instructor mistakes from being blamed on students.

## Performance

Phase 1 performance targets are pragmatic:

- the UI remains responsive during Python execution;
- repeat runs use browser-cached Pyodide assets;
- normal introductory programs complete comfortably within the default timeout;
- output is truncated after configured character and line limits;
- test counts and asset sizes have conservative limits;
- the worker is replaced after a timeout without requiring a page reload.

Premature optimization of Pyodide initialization should not complicate the initial implementation.

## Accessibility

- Every editor and result control has a visible label.
- Run, Grade, Reset, and reveal controls are keyboard accessible.
- Status changes use an appropriate live region.
- Pass/fail is not communicated by color alone.
- Output and tracebacks are selectable text.
- Focus moves predictably after Run and Grade.
- The editor has a plain-textarea fallback.
- Reduced-motion preferences are respected.

## Testing strategy

### Assignment validation

- valid minimal assignment;
- bad schema version;
- missing starter, solution, or evaluation;
- invalid filename and path traversal;
- duplicate or missing test metadata;
- incorrect point total;
- missing asset;
- unsupported package;
- invalid timeout.

### Worker runtime

- `print()` capture;
- `stderr` capture;
- syntax error;
- runtime exception;
- `input()` with one and multiple lines;
- exhausted input;
- Unicode;
- file reading from an asset;
- file creation;
- repeat execution without stale module state;
- infinite loop timeout and worker recovery;
- oversized output truncation.

### `unittest` harness

- pass;
- assertion failure;
- error;
- skip;
- `setUp()` failure;
- evaluation syntax error;
- discovered test missing metadata;
- metadata naming a nonexistent test;
- multiple classes and groups;
- accurate point calculation;
- JSON-safe tracebacks.

### Udemy export

- minimal compatible assignment;
- `unittest.mock.patch`;
- prompt HTML for rich text instructions;
- explanation conversion;
- hints;
- partial-credit compatibility warning;
- asset incompatibility;
- package incompatibility;
- solution failure blocks export;
- starter passing everything blocks export by default;
- safe ZIP member names;
- golden package-member comparisons;
- ZIP created without any server write.

### Browser tests

Test at least current Firefox, Chrome, and Safari on desktop. The UI may be usable on a tablet, but Phase 1 does not promise a comfortable phone-based coding experience.

## Implementation phases

### Phase 0 — Runtime spike

Purpose: prove the risky browser runtime pieces before building Tsugi integration.

Build one static page that:

- loads one pinned Pyodide version in a Web Worker;
- runs `student.py`;
- supports complete stdin;
- captures stdout, stderr, syntax errors, and runtime exceptions;
- successfully imports `sys`, `io`, `unittest`, and `unittest.mock.patch`;
- runs a two-test `unittest` evaluation;
- returns structured test JSON;
- terminates an infinite loop and successfully starts a replacement worker.

Success criterion: the spike grades one “Hello, Name” assignment repeatedly without reloading the page.

The spike may be discarded. Do not build authoring or Tsugi storage into it.

### Phase 1 — Small complete grader

Purpose: deliver a useful end-to-end tool.

Implement:

- Tsugi launch and modes following WebGrader;
- one editable `student.py`;
- prompt, editor, stdin, output, and results;
- Run/Grade dirty-state lifecycle;
- worker execution and timeout recovery;
- ordinary `unittest` evaluation;
- structured per-test points and feedback;
- partial-credit score;
- student autosave and local backup;
- attempt recording, grade storage, and LTI passback;
- instructor Load solution;
- practical Edit mode with full JSON import/export;
- built-in assignment catalog;
- repository assets copied into the virtual filesystem;
- required-asset validation;
- repository-wide assignment validation script;
- at least five small built-in assignments;
- in-memory browser Udemy ZIP export;
- compatibility preview plus `manifest.json` and `COMPATIBILITY.md`;
- automated runtime, schema, and export tests;
- README with installation and assignment-authoring examples.

Keep Phase 1 to:

- one student file;
- standard library only;
- synchronous programs;
- whole-test points;
- no AI dependency;
- no server-side Python;
- no direct Udemy upload.

Success criteria:

- a learner can complete, run, grade, save, and receive an LTI score for each built-in;
- an infinite loop does not require closing the browser tab;
- every catalog assignment and required asset validates in CI;
- every reference solution passes;
- every starter fails at least one intended test;
- a compatible assignment downloads as a ZIP without writing generated files on the server;
- one exported exercise is manually verified in Udemy.

### Phase 2 — Better teaching feedback

Add only after Phase 1 is stable:

- test groups in the results interface;
- progressive hints;
- test-source reveal;
- solution reveal and comparison;
- clearer syntax-error annotations in the editor;
- per-test rerun where feasible;
- attempt-history detail;
- learner-created file summary;
- authoring forms for test metadata instead of relying mainly on raw JSON;
- cloning and renaming catalog assignments;
- stronger accessibility review.

### Phase 3 — Broader Python exercises

Possible additions:

- multiple editable Python files;
- supported Pyodide packages;
- pinned pure-Python `micropip` packages;
- richer asset authoring;
- CSV and JSON preview helpers;
- deterministic mocked HTTP responses;
- asynchronous Python exercises where Pyodide behavior is well understood;
- optional tiny PythonGrader helper library;
- expanded Udemy translation after live verification.

Each feature must declare its runtime and Udemy compatibility. Do not allow this phase to turn the tool into a general cloud IDE.

### Phase 4 — AI-assisted authoring

Add:

- assignment generation from a learning objective;
- solution and test drafting;
- edge-case suggestions;
- hint and explanation drafting;
- deterministic validation-and-repair loop;
- export compatibility repair suggestions.

AI assistance should edit the same visible assignment fields an instructor can edit manually. It must not create a second hidden assignment format.

## Explicitly deferred ideas

These are interesting but should not delay Phase 1:

- `pytest`;
- notebooks;
- live interactive stdin;
- graphical libraries;
- package search and automatic dependency inference;
- server-side authoritative grading;
- hidden tests;
- collaborative editing;
- direct GitHub commits from the authoring screen;
- direct Udemy API upload;
- a generalized common grader framework;
- plagiarism detection;
- AI scoring of free-form code.

## Initial built-in assignments

Use a small set that exercises the runtime, not a complete course:

1. **Hello, Name** — `input()`, `print()`, and patched I/O.
2. **Convert Elevator Floor** — arithmetic and input conversion.
3. **Pay Calculator** — functions and numeric assertions.
4. **Largest and Smallest** — loops and edge cases.
5. **Count Lines in a File** — required repository asset and filesystem access.

At least one assignment must use `unittest.mock.patch`, and at least one must use a required asset.

## Decisions that should remain firm

- Browser execution only.
- Pyodide always runs in a Web Worker.
- Assignment JSON is the source of truth.
- Tests are ordinary `unittest`.
- Points and teaching feedback live in JSON metadata.
- Tests and solutions are inspectable.
- Required assets live in the repository and are validated.
- Old asset paths remain available.
- PHP stays thin and never executes Python.
- Udemy export is derived, conservative, and explicit about loss.
- The Phase 1 Udemy ZIP is generated in browser memory.
- AI authoring waits until deterministic authoring and validation work.
- Simplicity beats abstraction.

## Final acceptance checklist

Phase 1 is complete when all are true:

- [ ] Pyodide version is pinned.
- [ ] All learner Python runs in a Web Worker.
- [ ] Infinite-loop timeout and worker recovery are tested.
- [ ] Run cannot accidentally grade stale source.
- [ ] Standard input, stdout, stderr, syntax errors, and exceptions work.
- [ ] `unittest` results are structured rather than text-parsed.
- [ ] Partial credit is correct.
- [ ] Grader errors are distinguished from student failures.
- [ ] Student work autosaves and restores.
- [ ] Tsugi attempts, grades, and LTI passback work.
- [ ] Catalog JSON validates.
- [ ] Required assets validate and mount correctly.
- [ ] Reference solutions pass.
- [ ] Starters fail at least one intended test.
- [ ] Instructor JSON import/export works.
- [ ] Udemy compatibility preview is explicit.
- [ ] Udemy ZIP is generated entirely in browser memory.
- [ ] No generated export files are written to the server.
- [ ] One exported exercise has been tested successfully in Udemy.

