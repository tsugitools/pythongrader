# PythonGrader

Tsugi tool for introductory Python exercises that run and grade in the browser with Pyodide.

## Install

Place this folder under your Tsugi `mod/` directory (e.g. `tsugi/mod/pythongrader` or a course tree `mod/pythongrader`). Install or enable the tool from the Tsugi admin / store UI so `register.php` is loaded.

## Instructor setup

1. Launch the tool in a placement.
2. Open **Settings** and choose a built-in assignment (e.g. **Basics: Hello, Name**).
3. Optionally open **Edit** to customize the placement copy (does not change the catalog file).
4. Switch to **Learner** to try Run / Grade.

## Learner flow

1. Edit `student.py` and optional stdin.
2. **Run / Restart** — explore output without scoring.
3. **Grade** — runs `unittest` evaluation, records an attempt, and submits an LTI grade (`earned / maximum_points`).

## Phase 0 spike

`spike/index.html` is a static runtime proof (no Tsugi). Serve the tool root over HTTP and open `/spike/index.html` if you need to debug the worker in isolation.

## Design

See [DESIGN.md](DESIGN.md).
