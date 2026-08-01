# PythonGrader

Tsugi tool for introductory Python exercises that run and grade in the browser with Pyodide.

## Install

Place this folder under your Tsugi `mod/` directory (e.g. `tsugi/mod/pythongrader` or a course tree `mod/pythongrader`). Install or enable the tool from the Tsugi admin / store UI so `register.php` is loaded.

## Instructor setup

1. Launch the tool in a placement.
2. Open **Settings** and choose a built-in assignment (e.g. **PY4E: 2.2 Welcome Name**), or preselect one with `exercise=` (see below).
3. Optionally open **Edit** to customize the placement copy (does not change the catalog file).
4. Switch to **Learner** to try Run / Grade.

### Selecting an assignment with `exercise=`

Built-in assignments are identified by a catalog **key** (for example `Exercise22`). You can set that key in any of these ways (same priority as `exercise.php`):

1. **Settings → Exercise** — choose a catalog entry in the placement settings form.
2. **LTI custom parameter** — send `exercise` on launch, e.g. in a Tsugi deep-link / custom config:

   ```json
   "custom": [ { "key": "exercise", "value": "Exercise22" } ]
   ```

3. **Query string** — on first launch (or when the placement should reload the built-in), open the tool with `?exercise=Exercise22`.

The value must be a catalog key from the table below. On load, PythonGrader copies that built-in’s `assignment.json` into the placement’s `lti_link.json` (and refreshes it when the catalog file revision changes).

## Built-in assignments

Each assignment includes a `learning_objective` and a learner `hint` for Udemy (exported as `learning-objective.txt` and `hint.html`).

| Key | Title | Learning objective |
| --- | --- | --- |
| `HelloName` | Basics: Hello, Name | Prompt for a name with input() and print a greeting that includes that name. |
| `Hello` | PY4E: Hello World | Use Python's print() function to display a simple greeting string. |
| `Loop` | PY4E: Loop with range | Use a for loop with range() to print a short sequence of integers. |
| `Exercise22` | PY4E: 2.2 Welcome Name | Read a name with input() and print a personalized Hello greeting. |
| `Exercise23` | PY4E: 2.3 Gross Pay | Convert input strings to numbers with float() and compute gross pay. |
| `Exercise31` | PY4E: 3.1 Overtime Pay | Use if/else to pay overtime (1.5x) for hours worked above 40. |
| `Exercise33` | PY4E: 3.3 Score Grade | Map a numeric score to a letter grade using if/elif/else. There is only one score — the solution does not need a loop. |
| `Exercise46` | PY4E: 4.6 computepay() | Write a computepay(h, r) function that returns gross pay with overtime. |
| `Exercise52` | PY4E: 5.2 Largest and Smallest | Loop until a sentinel value, track min and max, and catch invalid input with try/except. |
| `Exercise65` | PY4E: 6.5 Extract Number | Extract a number from a string with find() and slicing, then convert it with float(). |
| `FileOpen` | PY4E: Open and Count Lines | Open a text file and count its lines using a for loop. |
| `Exercise71` | PY4E: 7.1 File Uppercase | Open a user-chosen file and print its entire contents in uppercase. |
| `Exercise72` | PY4E: 7.2 Spam Confidence | Scan a mailbox file for confidence lines and compute their average without sum(). |
| `Exercise84` | PY4E: 8.4 Unique Words | Build a sorted list of unique words from a text file using split() and append(). |
| `Exercise85` | PY4E: 8.5 From Addresses | Parse email addresses from mailbox From lines and print a final count. |
| `Exercise94` | PY4E: 9.4 Most Prolific Sender | Use a dictionary to count senders and find the most prolific email address. |
| `Exercise102` | PY4E: 10.2 Hour Distribution | Count messages by hour of day and print the distribution sorted by hour. |
| `Exercise111` | PY4E: 11.1 Answer to Life, the Universe and Everything | Compute and print the Answer to Life, the Universe, and Everything (from The Hitchhiker's Guide to the Galaxy). |
| `Exercise119` | PY4E: 11.9 Regex Line Count | Count lines in a mailbox file that match a regular expression with re.search(). |

PY4E exercises are ported from `py4e/tools/pythonauto/exercises3.php` (Hello through 11.9), plus the original Hello Name sample. Keys and paths are defined in `assignments.php`. Shared files (`words.txt`, `romeo.txt`, `mbox-short.txt`) live under `assignments/_shared/files/`. Regenerate catalog JSON with:

```bash
python3 scripts/generate-py4e-assignments.py
```

## Learner flow

1. Edit `student.py` and optional stdin.
2. **Run / Restart** — explore output without scoring.
3. **Grade** — runs `unittest` evaluation, records an attempt, and submits an LTI grade (`earned / maximum_points`).

## Export to Udemy

In **Edit** mode, click **Export to Udemy** to preview compatibility, then **Download ZIP**. The ZIP is built entirely in the browser (`fflate`) and is never written on the server. Paste order: **title** → learning objective → solution → **required asset files** (if any) → evaluation → instructions → hint → solution explanation → **learner file** (last). Asset files are labeled with their Udemy filename (e.g. `mbox-short.txt`) for copy/paste. Rich-text fields are HTML (`instructions.html`, `hint.html`, `solution-explanation.html`). Evaluation paths that mention `student.py` are rewritten to Udemy’s `exercise.py`. Non-empty `packages` are still not exportable in Phase 1.

## Phase 0 spike

`spike/index.html` is a static runtime proof (no Tsugi). Serve the tool root over HTTP and open `/spike/index.html` if you need to debug the worker in isolation.

## Design

See [DESIGN.md](DESIGN.md).
