Fixture for finding evidence checks (lib/finding-evidence.mjs). Small, synthetic
Python code that produces one finding of each kind:

- complexity/function: `app/engine.py` `route`
- coupling/import-cycle: `app/a.py` ↔ `app/b.py`
- coupling/cycle: modules `domain` ↔ `ui`
- architecture/boundary: `domain` → `ui`, with `analysis.config.json`

Tests copy it to a temporary directory through `test/py-fixture.mjs`.
