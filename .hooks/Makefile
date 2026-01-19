# .hooks/Makefile - Git hook management
#
# Usage:
#   make -C .hooks install      # Install hooks
#   make -C .hooks uninstall    # Remove hooks
#   make -C .hooks status       # Show hook status
#   make -C .hooks enable-python   # Enable Python checks
#   make -C .hooks enable-jsts     # Enable JS/TS checks
#   make -C .hooks test         # Run pre-commit manually

HOOKS_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
REPO_ROOT := $(shell git rev-parse --show-toplevel)
GIT_HOOKS := $(REPO_ROOT)/.git/hooks
CHECKS_DIR := $(HOOKS_DIR)/pre-commit.d

.PHONY: install uninstall status enable-python enable-jsts disable-python disable-jsts test help

help:
	@echo ""
	@echo "Git Hook Management"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "  make install        Install git hooks"
	@echo "  make uninstall      Remove git hooks"
	@echo "  make status         Show current status"
	@echo "  make test           Run pre-commit manually"
	@echo ""
	@echo "  make enable-python  Enable Python checks"
	@echo "  make enable-jsts    Enable JS/TS checks"
	@echo "  make disable-python Disable Python checks"
	@echo "  make disable-jsts   Disable JS/TS checks"
	@echo ""

install:
	@echo "Installing git hooks..."
	@ln -sf $(HOOKS_DIR)/pre-commit $(GIT_HOOKS)/pre-commit
	@ln -sf $(HOOKS_DIR)/commit-msg $(GIT_HOOKS)/commit-msg
	@echo "Done! Hooks installed."

uninstall:
	@echo "Removing git hooks..."
	@rm -f $(GIT_HOOKS)/pre-commit
	@rm -f $(GIT_HOOKS)/commit-msg
	@echo "Done! Hooks removed."

status:
	@echo ""
	@echo "Installed hooks:"
	@ls -la $(GIT_HOOKS)/pre-commit $(GIT_HOOKS)/commit-msg 2>/dev/null || echo "  None installed"
	@echo ""
	@echo "Enabled checks:"
	@ls -1 $(CHECKS_DIR)/check-*.sh 2>/dev/null | xargs -I{} basename {} .sh | sed 's/^check-/  - /' || echo "  None"
	@echo ""
	@echo "Disabled checks:"
	@ls -1 $(CHECKS_DIR)/check-*.sh.disabled 2>/dev/null | xargs -I{} basename {} .sh.disabled | sed 's/^check-/  - /' || echo "  None"
	@echo ""

enable-python:
	@if [ -f "$(CHECKS_DIR)/check-python.sh.disabled" ]; then \
		mv $(CHECKS_DIR)/check-python.sh.disabled $(CHECKS_DIR)/check-python.sh; \
		echo "Python checks enabled"; \
	else \
		echo "Python checks already enabled or not found"; \
	fi

enable-jsts:
	@if [ -f "$(CHECKS_DIR)/check-jsts.sh.disabled" ]; then \
		mv $(CHECKS_DIR)/check-jsts.sh.disabled $(CHECKS_DIR)/check-jsts.sh; \
		echo "JS/TS checks enabled"; \
	else \
		echo "JS/TS checks already enabled or not found"; \
	fi

disable-python:
	@if [ -f "$(CHECKS_DIR)/check-python.sh" ]; then \
		mv $(CHECKS_DIR)/check-python.sh $(CHECKS_DIR)/check-python.sh.disabled; \
		echo "Python checks disabled"; \
	else \
		echo "Python checks already disabled or not found"; \
	fi

disable-jsts:
	@if [ -f "$(CHECKS_DIR)/check-jsts.sh" ]; then \
		mv $(CHECKS_DIR)/check-jsts.sh $(CHECKS_DIR)/check-jsts.sh.disabled; \
		echo "JS/TS checks disabled"; \
	else \
		echo "JS/TS checks already disabled or not found"; \
	fi

test:
	@bash $(HOOKS_DIR)/pre-commit
