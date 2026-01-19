#!/usr/bin/env python3
"""
Agent CLI - Run agents as separate processes that communicate via communications.json

Usage:
  python agent_cli.py watcher                    # Start the file watcher
  python agent_cli.py agent researcher           # Start an agent named "researcher"
  python agent_cli.py status                     # Show all agent statuses
  
Inside agent session:
  mission <text>     - Set your mission
  working <text>     - Set what you're working on
  done <text>        - Set what you've completed
  next <text>        - Set your next task
  request <agent> <text>  - Send a request to another agent
  requests           - Show requests directed at you
  complete <agent> <original> | <description>  - Complete a request
  deliveries         - Show deliveries for you
  ack                - Acknowledge/clear deliveries
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import sys
import threading
import time
from pathlib import Path
from datetime import datetime

from agent_comm import CommunicationsFile, FileWatcher, AgentStatus
from config import get_config

logger = logging.getLogger(__name__)


def run_watcher():
    """Run the file watcher as a standalone process."""
    config = get_config()
    print("=" * 60)
    print("  AGENT COMMUNICATION WATCHER")
    print(f"  Monitoring: {config.comm_file}")
    print("  Press Ctrl+C to stop")
    print("=" * 60)

    comm_file = CommunicationsFile(config.comm_file)
    last_hash = ""
    
    def handle_signal(sig, frame):
        print("\n[Watcher] Shutting down...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)
    
    while True:
        try:
            current_hash = comm_file.get_file_hash()
            
            if current_hash != last_hash and last_hash != "":
                data = comm_file.read_raw()
                updated_by = data.get("_meta", {}).get("last_updated_by", "unknown")
                timestamp = data.get("_meta", {}).get("last_updated", "")
                
                print(f"\n{'='*60}")
                print(f"📢 UPDATE at {timestamp}")
                print(f"   By: {updated_by}")
                
                if updated_by in data:
                    agent_data = data[updated_by]
                    print(f"   Mission:    {agent_data.get('mission', '')}")
                    print(f"   Working on: {agent_data.get('working_on', '')}")
                    print(f"   Done:       {agent_data.get('done', '')}")
                    print(f"   Next:       {agent_data.get('next', '')}")
                    
                    # Show requests
                    requests = agent_data.get('requests', [])
                    if requests:
                        print(f"   Requests:")
                        for req in requests:
                            print(f"     → {req[0]}: {req[1]}")
                    
                    # Show added
                    added = agent_data.get('added', [])
                    if added:
                        print(f"   Deliveries received:")
                        for add in added:
                            print(f"     ← {add[0]}: {add[1]}")
                
                print("=" * 60)
                
            last_hash = current_hash
            time.sleep(config.poll_interval)
            
        except KeyboardInterrupt:
            break
        except Exception:
            logger.exception("Error in watcher loop")
            time.sleep(1)


def run_agent(agent_name: str):
    """Run an interactive agent session."""
    config = get_config()
    print("=" * 60)
    print(f"  AGENT: {agent_name}")
    print("  Type 'help' for commands")
    print("=" * 60)

    comm_file = CommunicationsFile(config.comm_file)
    
    # Initialize agent in the file
    status = comm_file.get_agent(agent_name)
    if status is None:
        status = AgentStatus()
        comm_file.update_agent(agent_name, status)
        print(f"[{agent_name}] Registered as new agent")
    else:
        print(f"[{agent_name}] Resumed existing session")
    
    # Show current status
    show_my_status(comm_file, agent_name)
    
    # Start background watcher thread
    last_hash = comm_file.get_file_hash()
    running = True
    
    def watch_for_updates():
        nonlocal last_hash
        while running:
            try:
                current_hash = comm_file.get_file_hash()
                if current_hash != last_hash:
                    data = comm_file.read_raw()
                    updated_by = data.get("_meta", {}).get("last_updated_by")
                    
                    if updated_by and updated_by != agent_name:
                        print(f"\n\n{'='*50}")
                        print(f"📨 Update from {updated_by}")
                        
                        if updated_by in data:
                            d = data[updated_by]
                            if d.get('working_on'):
                                print(f"  Working on: {d['working_on']}")
                        
                        # Check for requests directed at us
                        my_requests = comm_file.get_requests_for_agent(agent_name)
                        new_reqs = [r for r in my_requests if r[0] == updated_by]
                        for from_agent, req in new_reqs:
                            print(f"  📥 NEW REQUEST: {req}")
                        
                        # Check for deliveries
                        my_data = data.get(agent_name, {})
                        added = my_data.get("added", [])
                        new_adds = [a for a in added if a[0] == updated_by]
                        for add in new_adds:
                            print(f"  📦 DELIVERY: {add[1]}")
                            print(f"     (for: {add[2]})")
                        
                        print("=" * 50)
                        print(f"\n[{agent_name}] > ", end="", flush=True)
                    
                    last_hash = current_hash
                time.sleep(config.poll_interval)
            except Exception:
                logger.debug("Error in background watcher thread", exc_info=True)
    
    watcher_thread = threading.Thread(target=watch_for_updates, daemon=True)
    watcher_thread.start()
    
    # Interactive loop
    try:
        while True:
            try:
                cmd = input(f"[{agent_name}] > ").strip()
            except EOFError:
                break
            
            if not cmd:
                continue
            
            parts = cmd.split(maxsplit=1)
            command = parts[0].lower()
            rest = parts[1] if len(parts) > 1 else ""
            
            if command in ("quit", "exit", "q"):
                break
            
            elif command == "mission":
                if rest:
                    comm_file.update_field(agent_name, "mission", rest)
                    print(f"✓ Mission: {rest}")
                else:
                    status = comm_file.get_agent(agent_name)
                    print(f"Mission: {status.mission if status else 'N/A'}")
            
            elif command in ("working", "working_on"):
                if rest:
                    comm_file.update_field(agent_name, "working_on", rest)
                    print(f"✓ Working on: {rest}")
                else:
                    status = comm_file.get_agent(agent_name)
                    print(f"Working on: {status.working_on if status else 'N/A'}")
            
            elif command == "done":
                if rest:
                    comm_file.update_field(agent_name, "done", rest)
                    print(f"✓ Done: {rest}")
                else:
                    status = comm_file.get_agent(agent_name)
                    print(f"Done: {status.done if status else 'N/A'}")
            
            elif command == "next":
                if rest:
                    comm_file.update_field(agent_name, "next", rest)
                    print(f"✓ Next: {rest}")
                else:
                    status = comm_file.get_agent(agent_name)
                    print(f"Next: {status.next if status else 'N/A'}")
            
            elif command == "request":
                # request <target_agent> <request text>
                req_parts = rest.split(maxsplit=1)
                if len(req_parts) >= 2:
                    target = req_parts[0]
                    request_text = req_parts[1]
                    comm_file.add_request(agent_name, target, request_text)
                    print(f"✓ 📤 Request sent to {target}: {request_text}")
                else:
                    print("Usage: request <agent_name> <request description>")
            
            elif command == "requests":
                # Show requests directed at this agent
                requests = comm_file.get_requests_for_agent(agent_name)
                if requests:
                    print(f"\n📥 Pending requests for you:")
                    for i, (from_agent, req) in enumerate(requests, 1):
                        print(f"  {i}. From {from_agent}: {req}")
                else:
                    print("No pending requests for you.")
            
            elif command == "complete":
                # complete <requesting_agent> <original_request> | <description>
                if "|" in rest:
                    before_pipe, description = rest.split("|", 1)
                    before_parts = before_pipe.strip().split(maxsplit=1)
                    if len(before_parts) >= 2:
                        requesting_agent = before_parts[0]
                        original_request = before_parts[1]
                        description = description.strip()
                        
                        comm_file.complete_request(
                            completing_agent=agent_name,
                            requesting_agent=requesting_agent,
                            original_request=original_request,
                            description=description
                        )
                        print(f"✓ ✅ Completed request for {requesting_agent}")
                    else:
                        print("Usage: complete <agent> <original request> | <description>")
                else:
                    print("Usage: complete <agent> <original request> | <description of completion>")
                    print("Example: complete researcher Implement auth API | Done! See auth.py for login/logout endpoints")
            
            elif command == "deliveries":
                # Show deliveries (added) for this agent
                status = comm_file.get_agent(agent_name)
                if status and status.added:
                    print(f"\n📦 Deliveries for you:")
                    for i, add in enumerate(status.added, 1):
                        if len(add) >= 3:
                            print(f"  {i}. From {add[0]}:")
                            print(f"     Description: {add[1]}")
                            print(f"     Original request: {add[2]}")
                else:
                    print("No deliveries.")
            
            elif command == "ack":
                # Acknowledge/clear deliveries
                comm_file.clear_added(agent_name)
                print("✓ Deliveries acknowledged and cleared")
            
            elif command == "status":
                show_my_status(comm_file, agent_name)
            
            elif command == "others":
                all_agents = comm_file.get_all_agents()
                for name, status in all_agents.items():
                    if name != agent_name:
                        print(f"\n📋 {name}:")
                        print(f"  Mission:    {status.mission or '-'}")
                        print(f"  Working on: {status.working_on or '-'}")
                        print(f"  Done:       {status.done or '-'}")
                        print(f"  Next:       {status.next or '-'}")
                        if status.requests:
                            print(f"  Requests:")
                            for req in status.requests:
                                print(f"    → {req[0]}: {req[1]}")
            
            elif command == "all":
                # Show full JSON state
                data = comm_file.read_raw()
                print(json.dumps(data, indent=2))
            
            elif command == "help":
                print("""
Commands:
  mission <text>      - Set your mission
  working <text>      - Set what you're working on
  done <text>         - Set what you've completed
  next <text>         - Set your next task
  
  request <agent> <text>   - Send a request to another agent
  requests                 - Show requests directed at you
  complete <agent> <original> | <description>  - Complete a request
  deliveries               - Show deliveries you received
  ack                      - Acknowledge/clear deliveries
  
  status              - Show your current status
  others              - Show status of other agents
  all                 - Show full JSON state
  quit                - Exit
                """)
            
            else:
                print(f"Unknown command: {command}. Type 'help' for commands.")
    
    finally:
        running = False
        print(f"[{agent_name}] Goodbye!")


def show_my_status(comm_file, agent_name):
    """Display current agent status."""
    status = comm_file.get_agent(agent_name)
    if status:
        print(f"\n📋 Your status:")
        print(f"  Mission:    {status.mission or '-'}")
        print(f"  Working on: {status.working_on or '-'}")
        print(f"  Done:       {status.done or '-'}")
        print(f"  Next:       {status.next or '-'}")
        
        if status.requests:
            print(f"\n  Your outgoing requests:")
            for req in status.requests:
                print(f"    → To {req[0]}: {req[1]}")
        
        if status.added:
            print(f"\n  Deliveries for you:")
            for add in status.added:
                if len(add) >= 3:
                    print(f"    ← From {add[0]}: {add[1]}")
        print()


def show_status():
    """Show status of all agents."""
    config = get_config()
    comm_file = CommunicationsFile(config.comm_file)
    
    print("=" * 60)
    print("  AGENT STATUS OVERVIEW")
    print("=" * 60)
    
    data = comm_file.read_raw()
    meta = data.get("_meta", {})
    print(f"Last updated: {meta.get('last_updated', 'Never')}")
    print(f"Updated by:   {meta.get('last_updated_by', 'N/A')}")
    
    all_agents = comm_file.get_all_agents()
    
    if not all_agents:
        print("\nNo agents registered yet.")
    else:
        for name, status in all_agents.items():
            print(f"\n📋 {name}:")
            print(f"   Mission:    {status.mission or '(not set)'}")
            print(f"   Working on: {status.working_on or '(not set)'}")
            print(f"   Done:       {status.done or '(not set)'}")
            print(f"   Next:       {status.next or '(not set)'}")
            
            if status.requests:
                print(f"   Outgoing requests:")
                for req in status.requests:
                    print(f"     → To {req[0]}: {req[1]}")
            
            if status.added:
                print(f"   Pending deliveries:")
                for add in status.added:
                    if len(add) >= 3:
                        print(f"     ← From {add[0]}: {add[1]}")
    
    print("\n" + "=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Agent Communication System CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s watcher                           Start the file watcher
  %(prog)s agent researcher                  Start agent "researcher"
  %(prog)s agent coder                       Start agent "coder"
  %(prog)s status                            Show all agent statuses
  
Workflow:
  1. Terminal 1: %(prog)s watcher
  2. Terminal 2: %(prog)s agent researcher
  3. Terminal 3: %(prog)s agent coder
  
  In researcher terminal:
    request coder Please implement the auth API
    
  In coder terminal:
    requests                              (see incoming requests)
    working Implementing auth API
    complete researcher Please implement the auth API | Done! See auth.py
    
  In researcher terminal:
    deliveries                            (see completed work)
    ack                                   (acknowledge receipt)
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    subparsers.add_parser("watcher", help="Start the file watcher")
    
    agent_parser = subparsers.add_parser("agent", help="Start an agent")
    agent_parser.add_argument("name", help="Name of the agent")
    
    subparsers.add_parser("status", help="Show all agent statuses")
    
    args = parser.parse_args()
    
    if args.command == "watcher":
        run_watcher()
    elif args.command == "agent":
        run_agent(args.name)
    elif args.command == "status":
        show_status()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
