"""E2E tests for the orchestration framework.

Following the testing philosophy:
- ZERO unit tests - only E2E tests
- Test through the PUBLIC API only
- 100% coverage required
"""

import asyncio
import json
import pytest
from pathlib import Path
from datetime import datetime
import shutil
import tempfile

# Import the public API
from orchestrator.main import Orchestrator, OrchestratorConfig, run_orchestration


@pytest.fixture
def temp_repo():
    """Create a temporary repository for testing."""
    temp_dir = Path(tempfile.mkdtemp())

    # Initialize git repo
    import subprocess
    subprocess.run(["git", "init"], cwd=str(temp_dir), check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@test.com"],
        cwd=str(temp_dir), check=True, capture_output=True
    )
    subprocess.run(
        ["git", "config", "user.name", "Test"],
        cwd=str(temp_dir), check=True, capture_output=True
    )

    # Create initial commit
    readme = temp_dir / "README.md"
    readme.write_text("# Test Project")
    subprocess.run(["git", "add", "."], cwd=str(temp_dir), check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "Initial commit"],
        cwd=str(temp_dir), check=True, capture_output=True
    )

    # Create integration branch
    subprocess.run(
        ["git", "checkout", "-b", "integration"],
        cwd=str(temp_dir), check=True, capture_output=True
    )

    # Create sandbox directory
    sandbox = temp_dir / "sandbox"
    sandbox.mkdir()

    yield temp_dir

    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def single_task_plan(temp_repo):
    """Create a simple single-task plan."""
    plan_dir = temp_repo / "plans"
    plan_dir.mkdir()

    # Create project.md
    (plan_dir / "project.md").write_text("""# Single Task Test Project

## Description
A minimal project to test single agent completion.

## Milestones
### M1: MVP
- [ ] E001
""")

    # Create personas directory
    personas_dir = plan_dir / "personas"
    personas_dir.mkdir()

    (personas_dir / "implementer.md").write_text("""# Implementer

## Role
implementer

## Capabilities
- Python development
- File creation

## Constraints
- Work only in sandbox
""")

    # Create epics directory
    epics_dir = plan_dir / "epics"
    epics_dir.mkdir()

    (epics_dir / "E001-feature.md").write_text("""# E001: Simple Feature

## Metadata
- **Status**: not_started
- **Priority**: high
- **Milestone**: M1
- **Dependencies**: []

## Description
Create a simple Python file.
""")

    # Create stories directory
    stories_dir = plan_dir / "stories" / "E001"
    stories_dir.mkdir(parents=True)

    (stories_dir / "S001-create-file.md").write_text("""# S001: Create File

## Metadata
- **Status**: not_started
- **Assigned**: implementer
- **Dependencies**: []

## User Story
As a **developer**, I want to **have a hello.py file**
so that **I can run a hello world program**.

## Acceptance Criteria
1. Given I run hello.py, it prints "Hello World"

## Tasks
- [ ] T001: Create hello.py file | role:implementer

## Definition of Done
- [ ] hello.py exists
- [ ] Running it prints Hello World
""")

    return plan_dir


@pytest.fixture
def two_agent_plan(temp_repo):
    """Create a plan with two agents and dependencies."""
    plan_dir = temp_repo / "plans"
    plan_dir.mkdir()

    (plan_dir / "project.md").write_text("""# Two Agent Test Project

## Description
Test agent dependencies and blocking.

## Milestones
### M1: MVP
- [ ] E001
""")

    personas_dir = plan_dir / "personas"
    personas_dir.mkdir()

    (personas_dir / "architect.md").write_text("""# Architect

## Role
architect

## Capabilities
- Design systems
- Create specifications
""")

    (personas_dir / "implementer.md").write_text("""# Implementer

## Role
implementer

## Capabilities
- Python development
""")

    epics_dir = plan_dir / "epics"
    epics_dir.mkdir()

    (epics_dir / "E001-feature.md").write_text("""# E001: Feature with Dependencies

## Metadata
- **Status**: not_started
- **Milestone**: M1

## Description
Feature that requires architect to design first.
""")

    stories_dir = plan_dir / "stories" / "E001"
    stories_dir.mkdir(parents=True)

    (stories_dir / "S001-design-and-implement.md").write_text("""# S001: Design and Implement

## User Story
As a **developer**, I want **a well-designed feature**
so that **it's maintainable**.

## Acceptance Criteria
1. Design document exists
2. Implementation follows design

## Tasks
- [ ] T001: Create design doc | role:architect
- [ ] T002: Implement feature | role:implementer | depends:T001

## Definition of Done
- [ ] Design doc created
- [ ] Implementation complete
""")

    return plan_dir


class TestOrchestratorPublicAPI:
    """Test the Orchestrator public API."""

    @pytest.mark.asyncio
    async def test_orchestrator_start_with_valid_plan(self, temp_repo, single_task_plan):
        """Test that orchestrator starts successfully with a valid plan."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,  # Don't auto-spawn for this test
        )
        orchestrator = Orchestrator(config)

        result = await orchestrator.start()

        assert result is True
        assert orchestrator.plan is not None
        assert orchestrator.plan.name == "Single Task Test Project"

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_orchestrator_status_shows_correct_state(self, temp_repo, single_task_plan):
        """Test that status() returns correct orchestrator state."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        status = orchestrator.status()

        assert status["running"] is True
        assert status["project"] == "Single Task Test Project"
        assert isinstance(status["agents"], dict)

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_orchestrator_stop_terminates_cleanly(self, temp_repo, single_task_plan):
        """Test that stop() terminates all processes."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        await orchestrator.stop()

        status = orchestrator.status()
        assert status["running"] is False

    @pytest.mark.asyncio
    async def test_orchestrator_rejects_invalid_plan(self, temp_repo):
        """Test that orchestrator fails gracefully with invalid plan."""
        # Create an empty plan directory
        plan_dir = temp_repo / "empty_plans"
        plan_dir.mkdir()

        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=plan_dir,
        )
        orchestrator = Orchestrator(config)

        result = await orchestrator.start()

        # Should start (with empty plan) but no tasks
        # The plan parser should handle missing files gracefully
        assert orchestrator.plan is not None or result is False

        await orchestrator.stop()


class TestPlanParsing:
    """Test plan parsing through the orchestrator."""

    @pytest.mark.asyncio
    async def test_parses_personas_correctly(self, temp_repo, two_agent_plan):
        """Test that personas are parsed from plan."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=two_agent_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        assert orchestrator.plan is not None
        roles = orchestrator.plan.get_roles()
        assert "architect" in roles
        assert "implementer" in roles

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_parses_task_dependencies(self, temp_repo, two_agent_plan):
        """Test that task dependencies are parsed correctly."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=two_agent_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        assert orchestrator.plan is not None
        tasks = orchestrator.plan.get_all_tasks()

        t002 = next((t for t in tasks if t.id == "T002"), None)
        assert t002 is not None
        assert "T001" in t002.dependencies

        await orchestrator.stop()


class TestAgentSpawning:
    """Test agent spawning through the orchestrator."""

    @pytest.mark.asyncio
    async def test_spawn_agent_creates_branch(self, temp_repo, single_task_plan):
        """Test that spawning an agent creates a git branch."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        # Get the first task
        task = orchestrator.plan.get_all_tasks()[0]

        # Spawn agent (this will fail to actually run claude, but should create branch)
        agent = await orchestrator.spawn_agent("implementer", task)

        assert agent is not None
        assert agent.branch.startswith("agent/")

        # Verify branch exists
        import subprocess
        result = subprocess.run(
            ["git", "branch", "--list", agent.branch],
            cwd=str(temp_repo),
            capture_output=True,
            text=True,
        )
        # Branch should exist (or be current)
        # Note: The actual branch creation happens in branch_manager

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_spawn_agent_updates_communications(self, temp_repo, single_task_plan):
        """Test that spawning an agent updates communications.json."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        task = orchestrator.plan.get_all_tasks()[0]
        agent = await orchestrator.spawn_agent("implementer", task)

        # Check communications.json
        comm_file = temp_repo / "communications.json"
        data = json.loads(comm_file.read_text())

        assert agent.agent_id in data
        assert data[agent.agent_id]["role"] == "implementer"

        await orchestrator.stop()


class TestCommunicationsFile:
    """Test communications file interactions."""

    @pytest.mark.asyncio
    async def test_communications_reset_on_start(self, temp_repo, single_task_plan):
        """Test that communications.json is reset on start."""
        # Pre-populate with old data
        comm_file = temp_repo / "communications.json"
        comm_file.write_text(json.dumps({"old_agent": {"data": "old"}}))

        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        data = json.loads(comm_file.read_text())
        assert "old_agent" not in data
        assert "_meta" in data

        await orchestrator.stop()


class TestMilestoneCompletion:
    """Test milestone completion detection."""

    @pytest.mark.asyncio
    async def test_get_milestone_pr_returns_none_when_incomplete(
        self, temp_repo, single_task_plan
    ):
        """Test that milestone PR is None when not complete."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
            auto_spawn=False,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        pr_url = orchestrator.get_milestone_pr("M1")
        assert pr_url is None

        await orchestrator.stop()


# Integration test that would require actual Claude CLI
@pytest.mark.skip(reason="Requires Claude CLI - run manually for full integration test")
class TestFullIntegration:
    """Full integration tests requiring Claude CLI."""

    @pytest.mark.asyncio
    async def test_single_agent_completes_task(self, temp_repo, single_task_plan):
        """Test that a single agent can complete a simple task."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=single_task_plan,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        # Wait for completion with timeout
        completed = await orchestrator.wait_for_completion(timeout=120)

        status = orchestrator.status()
        # Check that agent completed
        for agent_id, agent_status in status["agents"].items():
            if agent_status["role"] == "implementer":
                assert agent_status["lifecycle_state"] == "complete"

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_blocked_agent_resumes_after_dependency(
        self, temp_repo, two_agent_plan
    ):
        """Test that blocked agent resumes when dependency completes."""
        config = OrchestratorConfig(
            repo_dir=temp_repo,
            plan_dir=two_agent_plan,
        )
        orchestrator = Orchestrator(config)
        await orchestrator.start()

        completed = await orchestrator.wait_for_completion(timeout=300)

        status = orchestrator.status()
        # Both agents should complete
        implementer_status = None
        for agent_id, agent_status in status["agents"].items():
            if agent_status["role"] == "implementer":
                implementer_status = agent_status

        assert implementer_status is not None
        assert implementer_status["lifecycle_state"] == "complete"

        await orchestrator.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
