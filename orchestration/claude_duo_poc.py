#!/usr/bin/env python3
"""
Claude Code Duo POC - Two Claude Code CLI Processes Communicating

This POC launches two separate Claude Code CLI terminal processes that
communicate via a shared communications.json file.

Agent Roles:
  - RESEARCHER: Gathers requirements, requests implementation from Coder
  - CODER: Implements code based on Researcher's requests

Run: python3 claude_duo_poc.py
"""

import os
import subprocess
import json
import time
import sys
from pathlib import Path
from datetime import datetime


WORKING_DIR = Path(__file__).parent.parent.absolute()
COMM_FILE = WORKING_DIR / "communications.json"


def reset_communications():
    """Reset the communications file to initial state."""
    initial = {
        "_meta": {
            "version": "1.0",
            "last_updated": datetime.now().isoformat(),
            "last_updated_by": "system"
        }
    }
    with open(COMM_FILE, 'w') as f:
        json.dump(initial, f, indent=2)
    print(f"[System] Reset {COMM_FILE}")


def read_communications():
    """Read current state of communications."""
    with open(COMM_FILE, 'r') as f:
        return json.load(f)


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


def run_claude_agent(agent_name: str, task: str) -> subprocess.Popen:
    """Launch a Claude Code CLI process for an agent."""
    prompt = create_agent_prompt(agent_name, task)

    # Launch claude with the prompt
    cmd = ['claude', '--print', '--dangerously-skip-permissions', '-p', prompt]

    print(f"\n[System] Launching {agent_name}...")
    print(f"[System] Task: {task[:80]}...")

    proc = subprocess.Popen(
        cmd,
        cwd=str(WORKING_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    return proc


def wait_and_stream(proc: subprocess.Popen, agent_name: str, timeout: int = 120):
    """Wait for process and stream output."""
    start = time.time()
    output_lines = []

    while proc.poll() is None:
        if time.time() - start > timeout:
            print(f"[{agent_name}] Timeout after {timeout}s")
            proc.terminate()
            break

        line = proc.stdout.readline()
        if line:
            output_lines.append(line)
            # Print key lines
            stripped = line.strip()
            if stripped and not stripped.startswith('{') and len(stripped) < 200:
                print(f"[{agent_name}] {stripped}")

    # Get remaining output
    remaining, _ = proc.communicate(timeout=5)
    if remaining:
        output_lines.append(remaining)

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

    researcher_proc = run_claude_agent("researcher", researcher_task)
    researcher_output = wait_and_stream(researcher_proc, "researcher", timeout=60)

    print_state("After RESEARCHER")

    # Small delay to ensure file is written
    time.sleep(1)

    # Run coder second (sees researcher's request)
    print("\n" + "-"*65)
    print("[Phase 2] Starting CODER agent")
    print("-"*65)

    coder_proc = run_claude_agent("coder", coder_task)
    coder_output = wait_and_stream(coder_proc, "coder", timeout=60)

    print_state("After CODER")

    # Save final state
    final_state = read_communications()
    final_path = WORKING_DIR / "running" / "tracker.json"
    with open(final_path, 'w') as f:
        json.dump(final_state, f, indent=2)

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
