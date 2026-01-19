"""Generate .claude.md files for agent personas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from plan.models import ProjectPlan, Task, Persona
from .models import PersonaConfig, AgentInstance


class ClaudeMdGenerator:
    """Generates .claude.md files for agent sandboxes."""

    DEFAULT_TEMPLATE = """# {name} Agent

## My Role
I am a **{role}** agent in a multi-agent orchestration system.

## My Mission
{mission}

## My Capabilities
{capabilities}

## My Constraints
{constraints}

## Current Task
{current_task}

## Communication Protocol

I communicate with other agents via:
1. **Git commits** - For code delivery
2. **Pull requests** - For handoff to integration branch
3. **communications.json** - For status updates and requests

### Signaling Breakpoints

When I reach a natural stopping point, I update communications.json:

**Task Complete:**
```json
{{
    "lifecycle_state": "complete",
    "done": "Description of what I completed",
    "breakpoint": {{
        "type": "task_complete",
        "task_id": "T001",
        "summary": "Brief summary of work done"
    }}
}}
```

**Blocked:**
```json
{{
    "lifecycle_state": "blocked",
    "working_on": "What I'm waiting for",
    "breakpoint": {{
        "type": "blocked",
        "blocked_on": ["T002", "T003"],
        "reason": "Need X before I can continue"
    }}
}}
```

**PR Created:**
```json
{{
    "lifecycle_state": "pr_pending",
    "breakpoint": {{
        "type": "pr_created",
        "pr_url": "https://github.com/..."
    }}
}}
```

## Testing Philosophy

- Write **E2E tests only** - no unit tests
- Test through the **public API** only
- Each acceptance criterion must have a passing test
- Target **100% coverage** on all metrics
- If code can't be reached by a real user scenario, it's dead code

## Git Workflow

1. Work on branch: `{branch}`
2. Make small, atomic commits
3. When task is complete, create PR to integration branch
4. Signal breakpoint in communications.json
5. Wait for orchestrator to handle next steps

## Remember

- I work ONLY in the sandbox directory
- I follow the existing code style
- I don't over-engineer - just what's needed
- I signal breakpoints at natural stopping points
- Fresh context will be provided if I'm respawned
"""

    def __init__(self, plan: ProjectPlan):
        self.plan = plan

    def generate(
        self,
        persona_config: PersonaConfig,
        task: Optional[Task] = None,
        branch: str = "",
        context_summary: str = "",
    ) -> str:
        """
        Generate .claude.md content for an agent.

        Args:
            persona_config: The persona configuration
            task: The current task (if any)
            branch: The git branch for this agent
            context_summary: Additional context from previous runs
        """
        persona = persona_config.persona

        # Use custom template if available, otherwise default
        template = persona.claude_md_template or self.DEFAULT_TEMPLATE

        # Format capabilities
        capabilities = "\n".join(f"- {cap}" for cap in persona.capabilities) or "- General development"

        # Format constraints
        constraints = "\n".join(f"- {con}" for con in persona.constraints) or "- Follow project conventions"

        # Format current task
        if task:
            current_task = f"""
**Task ID:** {task.id}
**Description:** {task.description}
**Dependencies:** {', '.join(task.dependencies) if task.dependencies else 'None'}
"""
        else:
            current_task = "No task currently assigned. Check communications.json for available tasks."

        # Build mission from persona and plan context
        mission = self._build_mission(persona_config)

        content = template.format(
            name=persona.name,
            role=persona.role,
            mission=mission,
            capabilities=capabilities,
            constraints=constraints,
            current_task=current_task,
            branch=branch or "agent/unknown",
        )

        # Add context summary if provided (for respawned agents)
        if context_summary:
            content += f"""
## Context from Previous Run

{context_summary}
"""

        return content

    def _build_mission(self, persona_config: PersonaConfig) -> str:
        """Build a mission statement for the persona."""
        persona = persona_config.persona
        role = persona.role

        # Role-specific mission templates
        missions = {
            "architect": "Design system architecture and make technical decisions that guide the project.",
            "implementer": "Implement features based on specifications, following best practices.",
            "tester": "Write comprehensive E2E tests that verify acceptance criteria.",
            "documenter": "Create clear, accurate documentation for the codebase.",
            "reviewer": "Review code for quality, security, and adherence to standards.",
        }

        return missions.get(role, f"Contribute to the project as a {role}.")

    def write_to_sandbox(
        self,
        sandbox_path: Path,
        persona_config: PersonaConfig,
        task: Optional[Task] = None,
        branch: str = "",
        context_summary: str = "",
    ):
        """
        Write .claude.md to a sandbox directory.

        Args:
            sandbox_path: Path to the sandbox directory
            persona_config: The persona configuration
            task: The current task (if any)
            branch: The git branch for this agent
            context_summary: Additional context from previous runs
        """
        sandbox_path = Path(sandbox_path)
        sandbox_path.mkdir(parents=True, exist_ok=True)

        content = self.generate(persona_config, task, branch, context_summary)

        claude_md_path = sandbox_path / ".claude.md"
        claude_md_path.write_text(content)

        return claude_md_path

    def generate_context_summary(self, agent: AgentInstance) -> str:
        """
        Generate a context summary for a respawned agent.
        This captures the essential state from the previous run.
        """
        lines = []

        lines.append(f"**Spawn #{agent.spawn_count}** - {datetime.now().isoformat()}")
        lines.append("")

        # Previous task progress
        if agent.current_task:
            lines.append("### Previous Task")
            lines.append(f"- **Task:** {agent.current_task.id} - {agent.current_task.description}")
            lines.append(f"- **Status:** {agent.current_task.status.value}")
            lines.append("")

        # Breakpoint info
        if agent.breakpoint:
            lines.append("### Last Breakpoint")
            lines.append(f"- **Type:** {agent.breakpoint.type}")
            if agent.breakpoint.summary:
                lines.append(f"- **Summary:** {agent.breakpoint.summary}")
            if agent.breakpoint.blocked_on:
                lines.append(f"- **Blocked on:** {', '.join(agent.breakpoint.blocked_on)}")
            if agent.breakpoint.reason:
                lines.append(f"- **Reason:** {agent.breakpoint.reason}")
            lines.append("")

        # Git state
        if agent.commits:
            lines.append("### Git History")
            for commit in agent.commits[-5:]:  # Last 5 commits
                lines.append(f"- {commit}")
            lines.append("")

        # Retry info
        if agent.retry_count > 0:
            lines.append(f"### Retry Info")
            lines.append(f"- **Previous retries:** {agent.retry_count}")
            lines.append("")

        return "\n".join(lines)
