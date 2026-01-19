#!/usr/bin/env python3
"""
Claude Code Duo POC - Two Claude Code CLI Processes Communicating

This POC launches two separate Claude Code CLI terminal processes that
communicate via a shared communications.json file.

Agent Roles:
  - RESEARCHER: Gathers requirements, requests implementation from Coder
  - CODER: Implements code based on Researcher's requests

Run: python3 examples/poc/duo_demo.py

NOTE: This is a proof-of-concept for demonstration purposes.
For production use, see the orchestrator module.
"""

import os
import subprocess
import json
import time
import sys
import atexit
from pathlib import Path
from datetime import datetime
from typing import Optional, List


# Configuration
WORKING_DIR = Path(__file__).parent.parent.parent.absolute()
COMM_FILE = WORKING_DIR / "communications.json"
DEFAULT_TIMEOUT = 120  # seconds
SYNC_DELAY = 2.0  # seconds to wait for file sync

# Track running processes for cleanup
_running_processes: List[subprocess.Popen] = []


def _cleanup_processes():
    """Clean up any running processes on exit."""
    for proc in _running_processes:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


atexit.register(_cleanup_processes)


class POCError(Exception):
    """Base exception for POC errors."""
    pass


def reset_communications() -> None:
    """Reset the communications file to initial state."""
    initial = {
        "_meta": {
            "version": "1.0",
            "last_updated": datetime.now().isoformat(),
            "last_updated_by": "system"
        }
    }
    try:
        with open(COMM_FILE, 'w') as f:
            json.dump(initial, f, indent=2)
        print(f"[System] Reset {COMM_FILE}")
    except IOError as e:
        raise POCError(f"Failed to reset communications file: {e}") from e


def read_communications() -> dict:
    """Read current state of communications."""
    try:
        with open(COMM_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"_meta": {"error": "Communications file not found"}}
    except json.JSONDecodeError as e:
        return {"_meta": {"error": f"Invalid JSON: {e}"}}


def print_state(label: str):
    """Print current communications state."""
    print(f"\n{'='*60}")
    print(f"  {label}")
    print('='*60)
    data = read_communications()
    print(json.dumps(data, indent=2))


def create_agent_prompt(agent_name: str, role_instructions: str) -> str:
    """Create the initial prompt for a Claude Code agent."""
    return f"""You are agent "{agent_name}" in a multi-agent system.

CRITICAL: You communicate with other agents via the file: {COMM_FILE}

{role_instructions}

## How to Communicate

1. READ the communications file to see current state:
   cat {COMM_FILE}

2. UPDATE your status using jq or python:
   python3 -c "
import json
with open('{COMM_FILE}', 'r') as f: data = json.load(f)
data['{agent_name}'] = data.get('{agent_name}', {{}})
data['{agent_name}']['mission'] = 'YOUR MISSION'
data['{agent_name}']['working_on'] = 'CURRENT TASK'
data['{agent_name}']['done'] = 'WHAT YOU COMPLETED'
data['{agent_name}']['requests'] = []  # [[target_agent, request_text], ...]
data['{agent_name}']['added'] = []  # deliveries you received
data['_meta']['last_updated'] = __import__('datetime').datetime.now().isoformat()
data['_meta']['last_updated_by'] = '{agent_name}'
with open('{COMM_FILE}', 'w') as f: json.dump(data, f, indent=2)
"

3. To REQUEST something from another agent, add to your requests array:
   requests: [["other_agent_name", "what you need"]]

4. To DELIVER to another agent, add to their 'added' array:
   They will see: [["from_you", "description", "original_request"]]

5. Check the file periodically to see updates from other agents.

START by reading the current state, then begin your task.
"""


def run_claude_agent(agent_name: str, task: str, skip_permissions: bool = False) -> subprocess.Popen:
    """
    Launch a Claude Code CLI process for an agent.

    Args:
        agent_name: Name of the agent
        task: Task instructions for the agent
        skip_permissions: If True, skip permission prompts (use with caution)

    Returns:
        subprocess.Popen instance

    Raises:
        POCError: If the claude command is not found
    """
    prompt = create_agent_prompt(agent_name, task)

    # Build command - note: --dangerously-skip-permissions should be used with caution
    cmd = ['claude', '--print', '-p', prompt]
    if skip_permissions:
        cmd.insert(2, '--dangerously-skip-permissions')

    print(f"\n[System] Launching {agent_name}...")
    print(f"[System] Task: {task[:80]}...")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(WORKING_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        _running_processes.append(proc)
        return proc
    except FileNotFoundError:
        raise POCError("'claude' command not found. Is Claude Code CLI installed?")


def wait_and_stream(proc: subprocess.Popen, agent_name: str, timeout: int = DEFAULT_TIMEOUT) -> str:
    """
    Wait for process and stream output.

    Args:
        proc: The subprocess to wait for
        agent_name: Name of the agent (for logging)
        timeout: Maximum time to wait in seconds

    Returns:
        Combined output from the process
    """
    start = time.time()
    output_lines = []
    timed_out = False

    while proc.poll() is None:
        if time.time() - start > timeout:
            print(f"[{agent_name}] Timeout after {timeout}s")
            proc.terminate()
            timed_out = True
            break

        line = proc.stdout.readline()
        if line:
            output_lines.append(line)
            # Print key lines
            stripped = line.strip()
            if stripped and not stripped.startswith('{') and len(stripped) < 200:
                print(f"[{agent_name}] {stripped}")

    # Get remaining output with timeout protection
    try:
        remaining, _ = proc.communicate(timeout=10)
        if remaining:
            output_lines.append(remaining)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.communicate()  # Clean up

    # Remove from tracking list
    if proc in _running_processes:
        _running_processes.remove(proc)

    return ''.join(output_lines)


def main():
    print("="*65)
    print("  CLAUDE CODE DUO POC")
    print("  Two Claude Code CLI processes communicating via JSON")
    print("="*65)

    # Reset state
    reset_communications()

    # Define agent tasks
    researcher_task = """
## Your Role: RESEARCHER

Your mission: Gather requirements for a user authentication system.

Tasks:
1. First, update your status in communications.json with your mission
2. Add a REQUEST for the coder agent asking them to implement a login function
3. Set your working_on to "Waiting for coder to implement login"
4. Read the file again to confirm your updates

Your request to coder should be:
  requests: [["coder", "Implement a Python login function that validates username/password"]]

After updating, output "RESEARCHER READY" and stop.
"""

    coder_task = """
## Your Role: CODER

Your mission: Implement code based on requests from other agents.

Tasks:
1. First, read communications.json to see if there are any requests for you
2. Look for requests where you are the target (requests: [["coder", "..."]])
3. Update your status showing you're working on the request
4. When done, add a DELIVERY to the researcher's 'added' array:
   added: [["coder", "Implemented login() in auth.py", "original request text"]]
5. Update your 'done' field to show completion

After updating, output "CODER COMPLETE" and stop.
"""

    # Run researcher first
    print("\n" + "-"*65)
    print("[Phase 1] Starting RESEARCHER agent")
    print("-"*65)

    try:
        researcher_proc = run_claude_agent("researcher", researcher_task, skip_permissions=True)
        researcher_output = wait_and_stream(researcher_proc, "researcher", timeout=60)
    except POCError as e:
        print(f"[ERROR] {e}")
        return

    print_state("After RESEARCHER")

    # Delay to ensure file is written and synced
    print(f"[System] Waiting {SYNC_DELAY}s for file sync...")
    time.sleep(SYNC_DELAY)

    # Run coder second (sees researcher's request)
    print("\n" + "-"*65)
    print("[Phase 2] Starting CODER agent")
    print("-"*65)

    try:
        coder_proc = run_claude_agent("coder", coder_task, skip_permissions=True)
        coder_output = wait_and_stream(coder_proc, "coder", timeout=60)
    except POCError as e:
        print(f"[ERROR] {e}")
        return

    print_state("After CODER")

    # Save final state
    final_state = read_communications()
    final_path = WORKING_DIR / ".state" / "tracker.json"
    final_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(final_path, 'w') as f:
            json.dump(final_state, f, indent=2)
    except IOError as e:
        print(f"[WARNING] Could not save final state: {e}")

    print("\n" + "="*65)
    print("  POC COMPLETE")
    print(f"  Final state saved to: {final_path}")
    print("="*65)

    # Verify communication happened
    if "researcher" in final_state and "coder" in final_state:
        print("\n[SUCCESS] Both agents registered in communications.json")

        researcher_data = final_state.get("researcher", {})
        coder_data = final_state.get("coder", {})

        if researcher_data.get("added"):
            print("[SUCCESS] Researcher received delivery from Coder")
        if coder_data.get("done"):
            print(f"[SUCCESS] Coder completed: {coder_data.get('done')}")
    else:
        print("\n[CHECK] Review tracker.json to verify communication")


if __name__ == "__main__":
    main()
