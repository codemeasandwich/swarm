# CLI

> Interactive command-line interface for agent management.

## Overview

The CLI module provides an interactive terminal interface for running agents and monitoring the communication system. It supports three modes:

- **watcher** - Monitor file changes in real-time
- **agent** - Run an interactive agent session
- **status** - Show current status of all agents

## Quick Start

### Start the File Watcher

```bash
python -m cli.main watcher
```

### Start an Agent

```bash
python -m cli.main agent researcher
```

### Check Status

```bash
python -m cli.main status
```

## Multi-Terminal Workflow

**Terminal 1 - File Watcher:**
```bash
python -m cli.main watcher
```

**Terminal 2 - First Agent:**
```bash
python -m cli.main agent researcher

researcher> mission Gather API requirements
researcher> request coder Please implement the auth module
researcher> status
```

**Terminal 3 - Second Agent:**
```bash
python -m cli.main agent coder

coder> requests
# Shows: "From researcher: Please implement the auth module"

coder> working Implementing auth module
coder> complete researcher Please implement the auth module | Done! See auth.py
```

**Back in Terminal 2:**
```bash
researcher> deliveries
# Shows completed work from coder

researcher> ack
# Clears deliveries
```

## Commands Reference

### Status Commands

| Command | Description |
|---------|-------------|
| `mission <text>` | Set your mission |
| `working <text>` | Set current task |
| `done <text>` | Mark work as complete |
| `next <text>` | Set next planned task |
| `status` | View your current status |

### Communication Commands

| Command | Description |
|---------|-------------|
| `request <agent> <text>` | Send a request to another agent |
| `requests` | View requests directed at you |
| `complete <agent> <request> \| <description>` | Complete a request |
| `deliveries` | View work delivered to you |
| `ack` | Acknowledge and clear deliveries |

### Other Commands

| Command | Description |
|---------|-------------|
| `others` | Show status of other agents |
| `all` | Show full JSON state |
| `help` | Show all commands |
| `quit` | Exit |

## Usage Examples

### Setting Status

```
researcher> mission Research authentication best practices
researcher> working Reading OAuth 2.0 documentation
researcher> done Completed security review
researcher> next Write requirements document
```

### Sending Requests

```
researcher> request coder Please implement JWT token validation
# Request sent to coder: Please implement JWT token validation
```

### Completing Requests

```
coder> requests
Pending requests for you:
  1. From researcher: Please implement JWT token validation

coder> complete researcher Please implement JWT token validation | Done! Added jwt_utils.py with validate_token function
# Completed request for researcher
```

### Checking Deliveries

```
researcher> deliveries
Deliveries for you:
  1. From coder:
     Description: Done! Added jwt_utils.py with validate_token function
     Original request: Please implement JWT token validation

researcher> ack
Deliveries acknowledged and cleared
```

## Configuration

The CLI uses settings from `config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `comm_file` | `communications.json` | Path to communications file |
| `poll_interval` | `0.5` | Seconds between file checks |

## Related Modules

- [/communication](../communication/) - Underlying communication system
- [/orchestrator](../orchestrator/) - Automated agent coordination

## Files

- [`main.py`](./main.py) - CLI implementation
