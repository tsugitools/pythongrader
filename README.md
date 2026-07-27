# PythonGrader

Tsugi tool for introductory Python exercises that run and grade in the browser with Pyodide.

## Install

Place this folder under your Tsugi `mod/` directory (e.g. `tsugi/mod/pythongrader` or a course tree `mod/pythongrader`). Install or enable the tool from the Tsugi admin / store UI so `register.php` is loaded.

## Instructor setup

1. Launch the tool in a placement.
2. Open **Settings** and choose a built-in assignment (e.g. **PY4E: 2.2 Welcome Name**).
3. Optionally open **Edit** to customize the placement copy (does not change the catalog file).
4. Switch to **Learner** to try Run / Grade.

## PY4E catalog

Built-in exercises are ported from `py4e/tools/pythonauto/exercises3.php` (Hello through 11.9), plus the original Hello Name sample. Shared files (`words.txt`, `romeo.txt`, `mbox-short.txt`) live under `assignments/_shared/files/`. Regenerate with:

```bash
python3 scripts/generate-py4e-assignments.py
```

## Learner flow

1. Edit `student.py` and optional stdin.
2. **Run / Restart** — explore output without scoring.
3. **Grade** — runs `unittest` evaluation, records an attempt, and submits an LTI grade (`earned / maximum_points`).

## Export to Udemy

In **Edit** mode, click **Export to Udemy** to preview compatibility, then **Download ZIP**. The ZIP is built entirely in the browser (`fflate`) and is never written on the server. Package members: `starter.py`, `solution.py`, `evaluation.py`, `instructions.md`, optional `hints.md` / `solution-explanation.md`, `manifest.json`, and `COMPATIBILITY.md`. Assignments with repository assets or non-empty `packages` are reported as not exportable in Phase 1.

## Phase 0 spike

`spike/index.html` is a static runtime proof (no Tsugi). Serve the tool root over HTTP and open `/spike/index.html` if you need to debug the worker in isolation.

## Design

See [DESIGN.md](DESIGN.md).
