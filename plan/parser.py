"""Markdown parser for project plans."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    AcceptanceCriterion,
    TestScenario,
    Task,
    TaskStatus,
    Story,
    StoryStatus,
    Epic,
    EpicStatus,
    Milestone,
    Persona,
    ProjectPlan,
)


class PlanParser:
    """Parses markdown files into plan data structures."""

    def parse_plan(self, plan_dir: Path) -> ProjectPlan:
        """Parse a complete project plan from a directory."""
        plan_dir = Path(plan_dir)

        # Parse project.md for overview
        project_file = plan_dir / "project.md"
        name, description, milestones = self._parse_project_file(project_file)

        # Parse personas
        personas_dir = plan_dir / "personas"
        personas = self._parse_personas_dir(personas_dir)

        # Parse epics and stories
        epics_dir = plan_dir / "epics"
        stories_dir = plan_dir / "stories"
        epics = self._parse_epics_and_stories(epics_dir, stories_dir)

        return ProjectPlan(
            name=name,
            description=description,
            epics=epics,
            milestones=milestones,
            personas=personas,
        )

    def _parse_project_file(self, filepath: Path) -> Tuple[str, str, List[Milestone]]:
        """Parse the main project.md file."""
        if not filepath.exists():
            return "", "", []

        content = filepath.read_text()
        lines = content.split("\n")

        name = ""
        description_lines = []
        milestones = []
        current_section = None
        in_milestone = False
        current_milestone = {}

        for line in lines:
            # Parse title
            if line.startswith("# "):
                name = line[2:].strip()
                continue

            # Track sections
            if line.startswith("## "):
                current_section = line[3:].strip().lower()
                in_milestone = False
                continue

            # Parse milestones
            if current_section == "milestones":
                milestone_match = re.match(r"^### (M\d+):\s*(.+)$", line)
                if milestone_match:
                    if current_milestone:
                        milestones.append(self._create_milestone(current_milestone))
                    current_milestone = {
                        "id": milestone_match.group(1),
                        "name": milestone_match.group(2),
                        "description": "",
                        "epic_ids": [],
                    }
                    in_milestone = True
                    continue

                if in_milestone and line.strip():
                    # Parse epic references
                    epic_match = re.match(r"^-\s*\[([ x])\]\s*(E\d+)", line)
                    if epic_match:
                        current_milestone["epic_ids"].append(epic_match.group(2))
                    elif not line.startswith("-"):
                        current_milestone["description"] += line.strip() + " "
                continue

            # Parse description
            if current_section == "description" or (not current_section and line.strip()):
                description_lines.append(line)

        # Add final milestone
        if current_milestone:
            milestones.append(self._create_milestone(current_milestone))

        return name, "\n".join(description_lines).strip(), milestones

    def _create_milestone(self, data: dict) -> Milestone:
        """Create a Milestone from parsed data."""
        return Milestone(
            id=data["id"],
            name=data["name"],
            description=data.get("description", "").strip(),
            epic_ids=data.get("epic_ids", []),
        )

    def _parse_personas_dir(self, personas_dir: Path) -> List[Persona]:
        """Parse all persona files in a directory."""
        personas = []
        if not personas_dir.exists():
            return personas

        for filepath in personas_dir.glob("*.md"):
            persona = self._parse_persona_file(filepath)
            if persona:
                personas.append(persona)

        return personas

    def _parse_persona_file(self, filepath: Path) -> Optional[Persona]:
        """Parse a single persona markdown file."""
        content = filepath.read_text()
        lines = content.split("\n")

        persona_id = filepath.stem
        name = ""
        role = ""
        capabilities = []
        constraints = []
        claude_md_lines = []
        current_section = None
        in_template = False

        for line in lines:
            # Parse title
            if line.startswith("# "):
                name = line[2:].strip()
                continue

            # Track sections
            if line.startswith("## "):
                section_name = line[3:].strip().lower()
                if "template" in section_name or "claude" in section_name:
                    current_section = "template"
                    in_template = True
                else:
                    current_section = section_name
                    in_template = False
                continue

            # Parse role
            if current_section == "role" and line.strip():
                role = line.strip()
                continue

            # Parse capabilities
            if current_section == "capabilities":
                cap_match = re.match(r"^-\s*(.+)$", line)
                if cap_match:
                    capabilities.append(cap_match.group(1).strip())
                continue

            # Parse constraints
            if current_section == "constraints":
                const_match = re.match(r"^-\s*(.+)$", line)
                if const_match:
                    constraints.append(const_match.group(1).strip())
                continue

            # Collect template content
            if in_template:
                claude_md_lines.append(line)

        return Persona(
            id=persona_id,
            name=name,
            role=role,
            capabilities=capabilities,
            constraints=constraints,
            claude_md_template="\n".join(claude_md_lines).strip(),
        )

    def _parse_epics_and_stories(self, epics_dir: Path, stories_dir: Path) -> List[Epic]:
        """Parse all epics and their associated stories."""
        epics = []
        if not epics_dir.exists():
            return epics

        for filepath in epics_dir.glob("*.md"):
            epic = self._parse_epic_file(filepath)
            if epic:
                # Load stories for this epic
                epic_stories_dir = stories_dir / epic.id
                if epic_stories_dir.exists():
                    for story_file in epic_stories_dir.glob("*.md"):
                        story = self._parse_story_file(story_file, epic.id)
                        if story:
                            epic.stories.append(story)
                epics.append(epic)

        return epics

    def _parse_epic_file(self, filepath: Path) -> Optional[Epic]:
        """Parse a single epic markdown file."""
        content = filepath.read_text()
        lines = content.split("\n")

        # Extract ID from filename (E001-feature.md -> E001)
        epic_id_match = re.match(r"(E\d+)", filepath.stem)
        epic_id = epic_id_match.group(1) if epic_id_match else filepath.stem

        title = ""
        description_lines = []
        status = EpicStatus.NOT_STARTED
        milestone_id = None
        priority = "medium"
        dependencies = []
        current_section = None

        for line in lines:
            # Parse title
            if line.startswith("# "):
                title_match = re.match(r"^#\s*(?:E\d+:\s*)?(.+)$", line)
                if title_match:
                    title = title_match.group(1).strip()
                continue

            # Track sections
            if line.startswith("## "):
                current_section = line[3:].strip().lower()
                continue

            # Parse metadata
            if current_section == "metadata":
                status_match = re.match(r"^-\s*\*\*Status\*\*:\s*(\w+)", line, re.IGNORECASE)
                if status_match:
                    try:
                        status = EpicStatus(status_match.group(1).lower())
                    except ValueError:
                        pass
                    continue

                priority_match = re.match(r"^-\s*\*\*Priority\*\*:\s*(\w+)", line, re.IGNORECASE)
                if priority_match:
                    priority = priority_match.group(1).lower()
                    continue

                milestone_match = re.match(r"^-\s*\*\*Milestone\*\*:\s*(M\d+)", line, re.IGNORECASE)
                if milestone_match:
                    milestone_id = milestone_match.group(1)
                    continue

                deps_match = re.match(r"^-\s*\*\*Dependencies\*\*:\s*\[([^\]]*)\]", line, re.IGNORECASE)
                if deps_match:
                    deps_str = deps_match.group(1)
                    if deps_str.strip():
                        dependencies = [d.strip() for d in deps_str.split(",")]
                    continue

            # Parse description
            if current_section == "description" and line.strip():
                description_lines.append(line)

        return Epic(
            id=epic_id,
            title=title,
            description="\n".join(description_lines).strip(),
            status=status,
            milestone_id=milestone_id,
            priority=priority,
            dependencies=dependencies,
        )

    def _parse_story_file(self, filepath: Path, epic_id: str) -> Optional[Story]:
        """Parse a single story markdown file."""
        content = filepath.read_text()
        lines = content.split("\n")

        # Extract ID from filename (S001-login-flow.md -> S001)
        story_id_match = re.match(r"(S\d+)", filepath.stem)
        story_id = story_id_match.group(1) if story_id_match else filepath.stem

        title = ""
        status = StoryStatus.NOT_STARTED
        as_a = ""
        i_want = ""
        so_that = ""
        acceptance_criteria = []
        test_scenarios = []
        tasks = []
        dependencies = []
        blocks = []
        technical_notes_lines = []
        current_section = None
        ac_counter = 0
        ts_counter = 0
        task_counter = 0

        for line in lines:
            # Parse title
            if line.startswith("# "):
                title_match = re.match(r"^#\s*(?:S\d+:\s*)?(.+)$", line)
                if title_match:
                    title = title_match.group(1).strip()
                continue

            # Track sections
            if line.startswith("## "):
                current_section = line[3:].strip().lower()
                continue

            # Parse metadata
            if current_section == "metadata":
                status_match = re.match(r"^-\s*\*\*Status\*\*:\s*(\w+)", line, re.IGNORECASE)
                if status_match:
                    try:
                        status = StoryStatus(status_match.group(1).lower().replace(" ", "_"))
                    except ValueError:
                        pass
                    continue

                deps_match = re.match(r"^-\s*\*\*Dependencies\*\*:\s*\[([^\]]*)\]", line, re.IGNORECASE)
                if deps_match:
                    deps_str = deps_match.group(1)
                    if deps_str.strip():
                        dependencies = [d.strip() for d in deps_str.split(",")]
                    continue

                blocks_match = re.match(r"^-\s*\*\*Blocks\*\*:\s*\[([^\]]*)\]", line, re.IGNORECASE)
                if blocks_match:
                    blocks_str = blocks_match.group(1)
                    if blocks_str.strip():
                        blocks = [b.strip() for b in blocks_str.split(",")]
                    continue

            # Parse user story
            if current_section == "user story" and line.strip():
                # Match: As a **user**, I want **to do X** so that **benefit**
                story_match = re.match(
                    r"^As\s+a?\s*\*\*(.+?)\*\*,?\s*I\s+want\s+(?:to\s+)?\*\*(.+?)\*\*\s*(?:so\s+that\s+\*\*(.+?)\*\*)?",
                    line, re.IGNORECASE
                )
                if story_match:
                    as_a = story_match.group(1).strip()
                    i_want = story_match.group(2).strip()
                    so_that = story_match.group(3).strip() if story_match.group(3) else ""
                continue

            # Parse acceptance criteria
            if "acceptance" in current_section.lower():
                ac_match = re.match(r"^(\d+)\.\s+(.+)$", line)
                if ac_match:
                    ac_counter += 1
                    ac = self._parse_acceptance_criterion(
                        f"AC{ac_counter:03d}",
                        ac_match.group(2).strip()
                    )
                    acceptance_criteria.append(ac)
                continue

            # Parse test scenarios
            if "test" in current_section.lower() and "scenario" in current_section.lower():
                ts_match = re.match(r"^-\s+(\w+)\(\)(.*)$", line)
                if ts_match:
                    ts_counter += 1
                    ts = TestScenario(
                        id=f"TS{ts_counter:03d}",
                        name=ts_match.group(1),
                        description=ts_match.group(2).strip() if ts_match.group(2) else "",
                        acceptance_criterion_id=f"AC{ts_counter:03d}" if ts_counter <= ac_counter else "",
                        test_function_name=ts_match.group(1),
                    )
                    test_scenarios.append(ts)
                continue

            # Parse tasks
            if current_section == "tasks":
                task_match = re.match(r"^-\s*\[([ x])\]\s*(T\d+):\s*(.+)$", line)
                if task_match:
                    is_complete = task_match.group(1).lower() == "x"
                    task_id = task_match.group(2)
                    task_desc_and_meta = task_match.group(3)

                    # Parse task description and metadata
                    task = self._parse_task_line(task_id, task_desc_and_meta, is_complete)
                    tasks.append(task)
                continue

            # Parse technical notes
            if "technical" in current_section.lower():
                technical_notes_lines.append(line)

        return Story(
            id=story_id,
            title=title,
            epic_id=epic_id,
            status=status,
            as_a=as_a,
            i_want=i_want,
            so_that=so_that,
            acceptance_criteria=acceptance_criteria,
            test_scenarios=test_scenarios,
            tasks=tasks,
            dependencies=dependencies,
            blocks=blocks,
            technical_notes="\n".join(technical_notes_lines).strip(),
        )

    def _parse_acceptance_criterion(self, ac_id: str, text: str) -> AcceptanceCriterion:
        """Parse an acceptance criterion, looking for Given/When/Then."""
        given = ""
        when = ""
        then = ""

        # Try to parse Given/When/Then format
        gwt_match = re.match(
            r"Given\s+(.+?),?\s+(?:when\s+(.+?),?\s+)?(?:then\s+)?(.+)$",
            text, re.IGNORECASE
        )
        if gwt_match:
            given = gwt_match.group(1).strip()
            when = gwt_match.group(2).strip() if gwt_match.group(2) else ""
            then = gwt_match.group(3).strip()

        return AcceptanceCriterion(
            id=ac_id,
            description=text,
            given=given,
            when=when,
            then=then,
        )

    def _parse_task_line(self, task_id: str, line: str, is_complete: bool) -> Task:
        """Parse a task line with description and metadata."""
        # Format: Description | role:implementer | depends:T001,T002
        parts = [p.strip() for p in line.split("|")]
        description = parts[0]
        role = ""
        dependencies = []

        for part in parts[1:]:
            role_match = re.match(r"role:(\w+)", part, re.IGNORECASE)
            if role_match:
                role = role_match.group(1)
                continue

            deps_match = re.match(r"depends?:([\w,]+)", part, re.IGNORECASE)
            if deps_match:
                dependencies = [d.strip() for d in deps_match.group(1).split(",")]
                continue

        status = TaskStatus.COMPLETE if is_complete else TaskStatus.AVAILABLE

        return Task(
            id=task_id,
            description=description,
            role=role,
            status=status,
            dependencies=dependencies,
            created_at=datetime.now(),
        )
