PYTHON ?= python
BACKEND_DIR := backend

.PHONY: install run debug clean lint lint-strict test

install:
	cd $(BACKEND_DIR) && $(PYTHON) -m pip install -e ".[dev]"

run:
	cd $(BACKEND_DIR) && $(PYTHON) -m app.etl.run_pipeline

debug:
	cd $(BACKEND_DIR) && $(PYTHON) -m pdb -m app.etl.run_pipeline

clean:
	$(PYTHON) -c "from pathlib import Path; import shutil; [shutil.rmtree(path, ignore_errors=True) for pattern in ('__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache') for path in Path('.').rglob(pattern)]"

lint:
	$(PYTHON) -m flake8 .
	$(PYTHON) -m mypy . --warn-return-any --warn-unused-ignores --ignore-missing-imports --disallow-untyped-defs --check-untyped-defs

lint-strict:
	$(PYTHON) -m flake8 .
	$(PYTHON) -m mypy . --strict

test:
	cd $(BACKEND_DIR) && pytest
