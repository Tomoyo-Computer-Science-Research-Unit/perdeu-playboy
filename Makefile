PYTHON ?= python
BACKEND_DIR := backend
FRONTEND_DIR := frontend
COMPOSE := docker compose

.PHONY: all install run debug clean fclean re lint lint-strict test front-build front-test up down logs

all: install lint test

install:
	cd $(BACKEND_DIR) && $(PYTHON) -m pip install -e ".[dev]"

run:
	cd $(BACKEND_DIR) && $(PYTHON) -m app.etl.run_pipeline

debug:
	cd $(BACKEND_DIR) && $(PYTHON) -m pdb -m app.etl.run_pipeline

clean:
	$(PYTHON) -c "from pathlib import Path; import shutil; [shutil.rmtree(path, ignore_errors=True) for pattern in ('__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache') for path in Path('.').rglob(pattern)]"

fclean: clean
	rm -rf $(BACKEND_DIR)/.venv $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/out

re: clean all

lint:
	$(PYTHON) -m flake8 .
	$(PYTHON) -m mypy . --warn-return-any --warn-unused-ignores --ignore-missing-imports --disallow-untyped-defs --check-untyped-defs

lint-strict:
	$(PYTHON) -m flake8 .
	$(PYTHON) -m mypy . --strict

test:
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest

front-build:
	cd $(FRONTEND_DIR) && npm run build

front-test:
	cd $(FRONTEND_DIR) && npx playwright test

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f
