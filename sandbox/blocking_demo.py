#!/usr/bin/env python3
"""
Multi-Agent Proof of Concept - Blocking Demo

Roles:
  - BUILDER: Needs to build an app, but is BLOCKED waiting for 2 things from Designer
  - DESIGNER: Creates the database schema and API spec

Flow:
  1. Builder requests 2 things from Designer (DB schema + API spec)
  2. Builder is BLOCKED - cannot proceed until both arrive
  3. Designer completes task 1 → file watcher notifies Builder
  4. Builder checks: still missing task 2, remains blocked
  5. Designer completes task 2 → file watcher notifies Builder  
  6. Builder checks: both received! UNBLOCKED, continues work
"""

import os
import pty
import sys
import time
import select
import json
from pathlib import Path
from datetime import datetime


class AgentTerminal:
    """Simple terminal wrapper for an agent."""
    
    def __init__(self, name: str, working_dir: str):
        self.name = name
        self.working_dir = working_dir
        self.master_fd = None
        self.pid = None
    
    def start(self):
        self.pid, self.master_fd = pty.fork()
        if self.pid == 0:
            os.chdir(self.working_dir)
            os.execlp('python3', 'python3', 'agent_cli.py', 'agent', self.name)
        time.sleep(0.5)
        self._drain()
    
    def send(self, cmd: str, wait: float = 0.3):
        """Send command and print response."""
        print(f"    [{self.name}] > {cmd}")
        os.write(self.master_fd, (cmd + '\n').encode())
        time.sleep(wait)
        output = self._drain()
        
        # Print relevant lines
        for line in output.split('\n'):
            line = line.strip()
            if line and '>' not in line and '===' not in line:
                if any(x in line for x in ['✓', '📥', '📦', '📤', 'BLOCKED', 'UNBLOCKED', 'Pending', 'Delivery', 'Mission', 'Working']):
                    print(f"    [{self.name}]   {line}")
        return output
    
    def _drain(self) -> str:
        output = ""
        while True:
            r, _, _ = select.select([self.master_fd], [], [], 0.3)
            if not r:
                break
            try:
                data = os.read(self.master_fd, 4096)
                if data:
                    output += data.decode('utf-8', errors='replace')
            except:
                break
        return output
    
    def stop(self):
        try:
            os.write(self.master_fd, b'quit\n')
            time.sleep(0.2)
            os.close(self.master_fd)
        except:
            pass


def run_demo(working_dir: str):
    """Run the blocking demo."""
    
    print("=" * 65)
    print("  MULTI-AGENT BLOCKING DEMO")
    print("  Builder is BLOCKED until Designer completes 2 tasks")
    print("=" * 65)
    
    # Reset communications file
    comm_file = Path(working_dir) / "communications.json"
    with open(comm_file, 'w') as f:
        json.dump({"_meta": {"version": "1.0", "last_updated": None, "last_updated_by": None}}, f)
    
    # Start agents
    builder = AgentTerminal("builder", working_dir)
    designer = AgentTerminal("designer", working_dir)
    
    print("\n[1] Starting agents...")
    builder.start()
    designer.start()
    
    # === PHASE 1: Builder makes requests ===
    print("\n" + "-" * 65)
    print("[2] BUILDER: Sets mission and requests 2 tasks from Designer")
    print("-" * 65)
    
    builder.send("mission Build the user management application")
    builder.send("request designer Need database schema for users table")
    builder.send("request designer Need API spec for user endpoints")
    builder.send("working_on BLOCKED - waiting for Designer to complete 2 tasks")
    
    time.sleep(0.5)
    
    # === PHASE 2: Designer sees requests ===
    print("\n" + "-" * 65)
    print("[3] DESIGNER: Sees incoming requests via file watcher")
    print("-" * 65)
    
    designer.send("requests")
    designer.send("mission Design database and API for Builder")
    
    # === PHASE 3: Designer completes FIRST task ===
    print("\n" + "-" * 65)
    print("[4] DESIGNER: Completes FIRST task (DB schema)")
    print("-" * 65)
    
    designer.send("working_on Creating database schema")
    time.sleep(0.3)
    designer.send("complete builder Need database schema for users table | Schema ready: users(id, email, password_hash, created_at)")
    
    time.sleep(0.8)
    
    # === PHASE 4: Builder checks - still blocked ===
    print("\n" + "-" * 65)
    print("[5] BUILDER: File watcher notified! Checks deliveries...")
    print("-" * 65)
    
    builder.send("deliveries")
    print("    [builder]   Still waiting for API spec - REMAINS BLOCKED")
    builder.send("working_on BLOCKED - received schema, still waiting for API spec")
    
    time.sleep(0.5)
    
    # === PHASE 5: Designer completes SECOND task ===
    print("\n" + "-" * 65)
    print("[6] DESIGNER: Completes SECOND task (API spec)")
    print("-" * 65)
    
    designer.send("working_on Creating API specification")
    time.sleep(0.3)
    designer.send("complete builder Need API spec for user endpoints | API ready: GET/POST/PUT/DELETE /users, auth via JWT")
    designer.send("done Both tasks delivered to Builder")
    
    time.sleep(0.8)
    
    # === PHASE 6: Builder unblocked ===
    print("\n" + "-" * 65)
    print("[7] BUILDER: File watcher notified! Checks again...")
    print("-" * 65)
    
    builder.send("deliveries")
    print("    [builder]   *** UNBLOCKED! Both deliveries received ***")
    builder.send("ack")
    builder.send("working_on Building user management app with schema and API spec")
    builder.send("next Deploy to staging environment")
    
    # === Cleanup ===
    print("\n" + "-" * 65)
    print("[8] Stopping agents...")
    print("-" * 65)
    
    builder.stop()
    designer.stop()
    
    # === Final JSON ===
    print("\n" + "=" * 65)
    print("  FINAL communications.json")
    print("=" * 65)
    
    with open(comm_file, 'r') as f:
        final = json.load(f)
    print(json.dumps(final, indent=2))
    
    # Save
    with open(Path(working_dir) / "running" / "tracker.json", 'w') as f:
        json.dump(final, f, indent=2)
    
    print("\n" + "=" * 65)
    print("  DEMO COMPLETE")
    print("  Builder was blocked on 2 tasks, unblocked when both arrived")
    print("=" * 65)


if __name__ == "__main__":
    working_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) or '.'
    run_demo(working_dir)
