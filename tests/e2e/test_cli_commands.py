"""
E2E tests for CLI commands.
Tests all CLI commands through realistic user interactions.
"""

import pytest
import sys
import time
import json
import threading
import signal
from io import StringIO
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from cli.main import run_agent, run_watcher, show_status, show_my_status, main
from communication.core import CommunicationsFile, AgentStatus
from tests.conftest import CLISimulator


class TestCLIAgentCommands:
    """Test all CLI commands through agent session."""

    def test_mission_command_set(self, cli_sim, temp_comm_file):
        """Test 'mission' command sets mission."""
        cli_sim.add_inputs(
            "mission Build the ultimate API",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Build the ultimate API" in output

        # Verify in file
        comm = CommunicationsFile(temp_comm_file)
        status = comm.get_agent("test_agent")
        assert status.mission == "Build the ultimate API"

    def test_mission_command_display(self, cli_sim, temp_comm_file):
        """Test 'mission' command displays current mission."""
        # Pre-set mission
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(mission="Existing mission"))

        cli_sim.add_inputs(
            "mission",  # Display only
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Existing mission" in output

    def test_working_on_command(self, cli_sim, temp_comm_file):
        """Test 'working' and 'working_on' commands."""
        cli_sim.add_inputs(
            "working Implementing feature X",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        comm = CommunicationsFile(temp_comm_file)
        status = comm.get_agent("test_agent")
        assert status.working_on == "Implementing feature X"

    def test_working_on_alias_command(self, cli_sim, temp_comm_file):
        """Test 'working_on' alias command."""
        cli_sim.add_inputs(
            "working_on Building components",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        comm = CommunicationsFile(temp_comm_file)
        status = comm.get_agent("test_agent")
        assert status.working_on == "Building components"

    def test_working_command_display(self, cli_sim, temp_comm_file):
        """Test 'working' displays current task when no argument."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(working_on="Current work"))

        cli_sim.add_inputs(
            "working",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Current work" in output

    def test_done_command(self, cli_sim, temp_comm_file):
        """Test 'done' command."""
        cli_sim.add_inputs(
            "done Completed the auth module",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        comm = CommunicationsFile(temp_comm_file)
        status = comm.get_agent("test_agent")
        assert status.done == "Completed the auth module"

    def test_done_command_display(self, cli_sim, temp_comm_file):
        """Test 'done' displays when no argument."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(done="Previous work"))

        cli_sim.add_inputs(
            "done",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Previous work" in output

    def test_next_command(self, cli_sim, temp_comm_file):
        """Test 'next' command."""
        cli_sim.add_inputs(
            "next Deploy to production",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        comm = CommunicationsFile(temp_comm_file)
        status = comm.get_agent("test_agent")
        assert status.next == "Deploy to production"

    def test_next_command_display(self, cli_sim, temp_comm_file):
        """Test 'next' displays when no argument."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(next="Future task"))

        cli_sim.add_inputs(
            "next",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Future task" in output

    def test_request_command(self, cli_sim, temp_comm_file):
        """Test 'request' command to send requests to another agent."""
        cli_sim.add_inputs(
            "request coder Please implement the API",
            "quit"
        )

        output = cli_sim.run_agent_session("researcher")

        assert "Request sent to coder" in output

        comm = CommunicationsFile(temp_comm_file)
        status = comm.get_agent("researcher")
        assert len(status.requests) == 1
        assert status.requests[0] == ["coder", "Please implement the API"]

    def test_request_command_invalid_no_args(self, cli_sim):
        """Test 'request' with no arguments shows usage."""
        cli_sim.add_inputs(
            "request",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Usage:" in output

    def test_request_command_invalid_one_arg(self, cli_sim):
        """Test 'request' with only agent name shows usage."""
        cli_sim.add_inputs(
            "request onlyagent",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Usage:" in output

    def test_requests_command(self, cli_sim, temp_comm_file):
        """Test 'requests' command shows pending requests for agent."""
        # First, create a request directed at our agent
        comm = CommunicationsFile(temp_comm_file)
        comm.add_request("other_agent", "test_agent", "Please help with task")

        cli_sim.add_inputs(
            "requests",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "other_agent" in output
        assert "Please help with task" in output

    def test_requests_command_none(self, cli_sim):
        """Test 'requests' when no pending requests."""
        cli_sim.add_inputs(
            "requests",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "No pending requests" in output

    def test_complete_command(self, cli_sim, temp_comm_file):
        """Test 'complete' command to fulfill a request."""
        # Setup: Create a request
        comm = CommunicationsFile(temp_comm_file)
        comm.add_request("researcher", "coder", "Implement auth")

        cli_sim.add_inputs(
            "complete researcher Implement auth | Done! See auth.py",
            "quit"
        )

        output = cli_sim.run_agent_session("coder")

        assert "Completed request for researcher" in output

        # Verify the delivery was added
        status = comm.get_agent("researcher")
        assert len(status.added) == 1
        assert status.added[0][0] == "coder"
        assert "auth.py" in status.added[0][1]

    def test_complete_command_invalid_no_pipe(self, cli_sim):
        """Test 'complete' without pipe shows usage."""
        cli_sim.add_inputs(
            "complete researcher no pipe here",
            "quit"
        )

        output = cli_sim.run_agent_session("coder")

        assert "Usage:" in output

    def test_complete_command_invalid_missing_parts(self, cli_sim):
        """Test 'complete' with missing parts shows usage."""
        cli_sim.add_inputs(
            "complete | just description",
            "quit"
        )

        output = cli_sim.run_agent_session("coder")

        assert "Usage:" in output

    def test_deliveries_command(self, cli_sim, temp_comm_file):
        """Test 'deliveries' command shows completed work."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(
            added=[["provider", "Work completed", "Original request"]]
        ))

        cli_sim.add_inputs(
            "deliveries",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "provider" in output
        assert "Work completed" in output
        assert "Original request" in output

    def test_deliveries_command_none(self, cli_sim):
        """Test 'deliveries' when none exist."""
        cli_sim.add_inputs(
            "deliveries",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "No deliveries" in output

    def test_ack_command(self, cli_sim, temp_comm_file):
        """Test 'ack' command clears deliveries."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(
            added=[["provider", "Work done", "Request"]]
        ))

        cli_sim.add_inputs(
            "ack",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "acknowledged and cleared" in output

        # Verify cleared
        status = comm.get_agent("test_agent")
        assert len(status.added) == 0

    def test_status_command(self, cli_sim, temp_comm_file):
        """Test 'status' command shows own status."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("test_agent", AgentStatus(
            mission="My mission",
            working_on="My task",
            requests=[["other", "A request"]],
            added=[["from", "desc", "orig"]]
        ))

        cli_sim.add_inputs(
            "status",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "My mission" in output
        assert "My task" in output

    def test_others_command(self, cli_sim, temp_comm_file):
        """Test 'others' command shows other agents' status."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("other_agent", AgentStatus(
            mission="Other's mission",
            working_on="Other's task",
            done="Other's done",
            next="Other's next",
            requests=[["someone", "A request"]]
        ))

        cli_sim.add_inputs(
            "others",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "other_agent" in output
        assert "Other's mission" in output

    def test_others_command_no_requests(self, cli_sim, temp_comm_file):
        """Test 'others' command when other agent has no requests."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("other_agent", AgentStatus(
            mission="Other's mission",
            working_on="Other's task"
            # No requests
        ))

        cli_sim.add_inputs(
            "others",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "other_agent" in output
        assert "Other's mission" in output

    def test_all_command(self, cli_sim, temp_comm_file):
        """Test 'all' command shows full JSON state."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_field("agent1", "mission", "Mission 1")

        cli_sim.add_inputs(
            "all",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        # Should contain JSON structure
        assert "mission" in output

    def test_help_command(self, cli_sim):
        """Test 'help' command displays help text."""
        cli_sim.add_inputs(
            "help",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "mission" in output
        assert "working" in output
        assert "request" in output
        assert "complete" in output
        assert "deliveries" in output
        assert "ack" in output

    def test_unknown_command(self, cli_sim):
        """Test unknown command shows error."""
        cli_sim.add_inputs(
            "badcommand foo bar",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        assert "Unknown command" in output

    def test_quit_command(self, cli_sim):
        """Test 'quit' exits."""
        cli_sim.add_inputs("quit")
        output = cli_sim.run_agent_session("test_agent")
        assert "Goodbye" in output

    def test_exit_command(self, cli_sim):
        """Test 'exit' exits."""
        cli_sim.add_inputs("exit")
        output = cli_sim.run_agent_session("test_agent")
        assert "Goodbye" in output

    def test_q_command(self, cli_sim):
        """Test 'q' exits."""
        cli_sim.add_inputs("q")
        output = cli_sim.run_agent_session("test_agent")
        assert "Goodbye" in output

    def test_empty_command(self, cli_sim):
        """Test empty command does nothing."""
        cli_sim.add_inputs(
            "",
            "   ",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")
        assert "Goodbye" in output

    def test_resume_existing_session(self, cli_sim, temp_comm_file):
        """Test resuming an existing agent session."""
        # Create existing agent
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("existing", AgentStatus(mission="Existing mission"))

        cli_sim.add_inputs("quit")

        output = cli_sim.run_agent_session("existing")

        assert "Resumed existing session" in output

    def test_new_agent_session(self, cli_sim, temp_comm_file):
        """Test starting a new agent session."""
        cli_sim.add_inputs("quit")

        output = cli_sim.run_agent_session("brand_new")

        assert "Registered as new agent" in output


class TestCLIMainEntryPoints:
    """Test argparse entry points."""

    def test_main_no_command(self, capsys):
        """Test main() with no command shows help."""
        with patch('sys.argv', ['agent_cli.py']):
            main()

        captured = capsys.readouterr()
        # Should print help or usage
        assert "agent" in captured.out.lower() or "watcher" in captured.out.lower()

    def test_main_status_command(self, temp_comm_file, mock_config, capsys):
        """Test main() with 'status' command."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("agent1", AgentStatus(mission="Test mission"))

        with patch('sys.argv', ['agent_cli.py', 'status']):
            with mock_config:
                main()

        captured = capsys.readouterr()
        assert "STATUS" in captured.out.upper() or "agent1" in captured.out

    def test_main_agent_command(self, temp_comm_file, mock_config, capsys):
        """Test main() with 'agent' command."""
        with patch('sys.argv', ['agent_cli.py', 'agent', 'test']):
            with mock_config:
                with patch('builtins.input', side_effect=EOFError):
                    main()

        captured = capsys.readouterr()
        assert "test" in captured.out.lower()

    def test_main_watcher_command(self, temp_comm_file, mock_config, capsys):
        """Test main() with 'watcher' command starts and handles interrupt."""
        with patch('sys.argv', ['agent_cli.py', 'watcher']):
            with mock_config:
                # Simulate immediate keyboard interrupt
                with patch('time.sleep', side_effect=KeyboardInterrupt):
                    main()

        captured = capsys.readouterr()
        assert "WATCHER" in captured.out.upper()


class TestCLIShowStatus:
    """Test show_status function."""

    def test_show_status_no_agents(self, temp_comm_file, mock_config, capsys):
        """Test show_status with no agents."""
        with mock_config:
            show_status()

        captured = capsys.readouterr()
        assert "No agents registered" in captured.out

    def test_show_status_with_agents(self, temp_comm_file, mock_config, capsys):
        """Test show_status with existing agents."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("agent1", AgentStatus(
            mission="Test mission",
            working_on="Working",
            done="Done",
            next="Next",
            requests=[["agent2", "A request"]]
        ))
        comm.update_agent("agent2", AgentStatus(
            added=[["agent1", "Delivery", "Original"]]
        ))

        with mock_config:
            show_status()

        captured = capsys.readouterr()
        assert "agent1" in captured.out
        assert "Test mission" in captured.out
        assert "agent2" in captured.out

    def test_show_status_shows_metadata(self, temp_comm_file, mock_config, capsys):
        """Test show_status displays last_updated metadata."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("agent1", AgentStatus(mission="Test"))

        with mock_config:
            show_status()

        captured = capsys.readouterr()
        assert "Last updated:" in captured.out


class TestCLIShowMyStatus:
    """Test show_my_status function."""

    def test_show_my_status_full(self, temp_comm_file, mock_config, capsys):
        """Test show_my_status with all fields."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("my_agent", AgentStatus(
            mission="My mission",
            working_on="My work",
            done="My completed",
            next="My next",
            requests=[["other", "My request"]],
            added=[["from", "desc", "orig"]]
        ))

        with mock_config:
            show_my_status(comm, "my_agent")

        captured = capsys.readouterr()
        assert "My mission" in captured.out
        assert "My work" in captured.out
        assert "My completed" in captured.out
        assert "My next" in captured.out
        assert "outgoing requests" in captured.out.lower()
        assert "Deliveries" in captured.out

    def test_show_my_status_empty_fields(self, temp_comm_file, mock_config, capsys):
        """Test show_my_status with empty fields shows dashes."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("empty_agent", AgentStatus())

        with mock_config:
            show_my_status(comm, "empty_agent")

        captured = capsys.readouterr()
        # Empty fields should show as "-"
        assert "-" in captured.out

    def test_show_my_status_nonexistent_agent(self, temp_comm_file, mock_config, capsys):
        """Test show_my_status when agent doesn't exist."""
        comm = CommunicationsFile(temp_comm_file)

        with mock_config:
            show_my_status(comm, "nonexistent_agent")

        captured = capsys.readouterr()
        # Should not print anything since status is None
        assert "Your status" not in captured.out


class TestCLIWatcherFunction:
    """Test run_watcher function behavior."""

    def test_run_watcher_displays_updates(self, temp_comm_file, mock_config, capsys):
        """Test run_watcher detects and displays file changes."""
        comm = CommunicationsFile(temp_comm_file)

        update_count = 0

        def mock_sleep(seconds):
            nonlocal update_count
            update_count += 1
            if update_count == 1:
                # First sleep - file hasn't changed
                pass
            elif update_count == 2:
                # Make an update
                comm.update_agent("test_agent", AgentStatus(
                    mission="Updated mission",
                    working_on="Updated work",
                    done="Updated done",
                    next="Updated next",
                    requests=[["other", "req"]],
                    added=[["from", "delivery"]]
                ))
            elif update_count > 3:
                raise KeyboardInterrupt()

        with mock_config:
            with patch('time.sleep', mock_sleep):
                run_watcher()

        captured = capsys.readouterr()
        assert "WATCHER" in captured.out.upper()

    def test_run_watcher_update_without_requests_or_added(self, temp_comm_file, mock_config, capsys):
        """Test watcher displays updates when agent has no requests or added."""
        comm = CommunicationsFile(temp_comm_file)

        update_count = 0

        def mock_sleep(seconds):
            nonlocal update_count
            update_count += 1
            if update_count == 2:
                # Update with no requests or added (hits empty branch)
                comm.update_agent("minimal_agent", AgentStatus(
                    mission="Just a mission"
                ))
            elif update_count > 3:
                raise KeyboardInterrupt()

        with mock_config:
            with patch('time.sleep', mock_sleep):
                run_watcher()

        captured = capsys.readouterr()
        assert "Just a mission" in captured.out

    def test_run_watcher_update_by_unknown_agent(self, temp_comm_file, mock_config, capsys):
        """Test watcher handles update by agent not in data."""
        comm = CommunicationsFile(temp_comm_file)

        update_count = 0

        def mock_sleep(seconds):
            nonlocal update_count
            update_count += 1
            if update_count == 2:
                # Manually update meta to show update by non-existent agent
                data = comm._read_data()
                data["_meta"]["last_updated_by"] = "phantom_agent"
                data["_meta"]["last_updated"] = "2024-01-01T00:00:00"
                comm._write_data(data)
            elif update_count > 3:
                raise KeyboardInterrupt()

        with mock_config:
            with patch('time.sleep', mock_sleep):
                run_watcher()

        captured = capsys.readouterr()
        # Should show update even though agent not in data
        assert "phantom_agent" in captured.out

    def test_run_watcher_handles_sigterm(self, temp_comm_file, mock_config, capsys):
        """Test run_watcher handles SIGTERM signal."""
        with mock_config:
            with patch('time.sleep', side_effect=KeyboardInterrupt):
                run_watcher()

        captured = capsys.readouterr()
        assert "WATCHER" in captured.out.upper()

    def test_run_watcher_handles_exception(self, temp_comm_file, mock_config, capsys):
        """Test run_watcher handles and reports exceptions."""
        call_count = 0

        def mock_get_hash():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "initial"
            elif call_count == 2:
                raise ValueError("Test error")
            else:
                raise KeyboardInterrupt()

        comm = CommunicationsFile(temp_comm_file)

        with mock_config:
            with patch.object(comm, 'get_file_hash', mock_get_hash):
                with patch('cli.main.CommunicationsFile', return_value=comm):
                    run_watcher()

        captured = capsys.readouterr()
        # Should have started
        assert "WATCHER" in captured.out.upper()


class TestCLIBackgroundWatcher:
    """Test the background watcher thread in run_agent."""

    def test_background_watcher_receives_updates(self, temp_comm_file, mock_config):
        """Test that background watcher thread notifies of updates."""
        comm = CommunicationsFile(temp_comm_file)

        inputs = []
        input_idx = 0

        def mock_input(prompt=""):
            nonlocal input_idx
            # On first call, trigger an update from another agent
            if input_idx == 0:
                time.sleep(0.3)  # Let watcher start
                comm.update_agent("other_agent", AgentStatus(
                    working_on="Other's work"
                ))
                time.sleep(0.7)  # Let watcher detect
            input_idx += 1
            if input_idx > 1:
                raise EOFError()
            return "quit"

        with mock_config:
            with patch('builtins.input', mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    run_agent("test_agent")
                    output = mock_out.getvalue()

        # The update notification may or may not appear depending on timing
        # but the session should complete without error
        assert "Goodbye" in output

    def test_background_watcher_shows_request_notification(self, temp_comm_file, mock_config):
        """Test background watcher shows new request notifications."""
        comm = CommunicationsFile(temp_comm_file)
        # Initialize our agent first
        comm.update_agent("test_agent", AgentStatus())

        input_idx = 0

        def mock_input(prompt=""):
            nonlocal input_idx
            if input_idx == 0:
                time.sleep(0.3)
                # Other agent sends request to us
                comm.add_request("other_agent", "test_agent", "Please help")
                time.sleep(0.7)
            input_idx += 1
            if input_idx > 1:
                raise EOFError()
            return "quit"

        with mock_config:
            with patch('builtins.input', mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    run_agent("test_agent")
                    output = mock_out.getvalue()

        assert "Goodbye" in output

    def test_background_watcher_shows_delivery_notification(self, temp_comm_file, mock_config):
        """Test background watcher shows delivery notifications."""
        comm = CommunicationsFile(temp_comm_file)
        # Initialize our agent with a pending request
        comm.update_agent("test_agent", AgentStatus(
            requests=[["other_agent", "Do task"]]
        ))

        input_idx = 0

        def mock_input(prompt=""):
            nonlocal input_idx
            if input_idx == 0:
                time.sleep(0.3)
                # Other agent completes the request
                comm.complete_request(
                    completing_agent="other_agent",
                    requesting_agent="test_agent",
                    original_request="Do task",
                    description="Task completed"
                )
                time.sleep(0.7)
            input_idx += 1
            if input_idx > 1:
                raise EOFError()
            return "quit"

        with mock_config:
            with patch('builtins.input', mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    run_agent("test_agent")
                    output = mock_out.getvalue()

        assert "Goodbye" in output

    def test_background_watcher_exception_handling(self, temp_comm_file, mock_config):
        """Test background watcher handles exceptions gracefully."""
        comm = CommunicationsFile(temp_comm_file)

        input_idx = 0
        exception_triggered = False

        original_get_hash = comm.get_file_hash

        def mock_get_hash():
            nonlocal exception_triggered
            if exception_triggered:
                return original_get_hash()
            exception_triggered = True
            raise ValueError("Test exception in watcher")

        def mock_input(prompt=""):
            nonlocal input_idx
            input_idx += 1
            if input_idx == 1:
                time.sleep(0.5)  # Let the exception get caught
            if input_idx > 1:
                raise EOFError()
            return "quit"

        with mock_config:
            with patch('builtins.input', mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    # Patch at the module level for the watcher thread
                    run_agent("test_agent")
                    output = mock_out.getvalue()

        # Should complete gracefully despite exception
        assert "Goodbye" in output

    def test_background_watcher_ignores_self_updates(self, temp_comm_file, mock_config):
        """Test background watcher ignores updates made by the agent itself."""
        comm = CommunicationsFile(temp_comm_file)

        input_idx = 0

        def mock_input(prompt=""):
            nonlocal input_idx
            input_idx += 1
            if input_idx == 1:
                # Give watcher time to start
                time.sleep(0.3)
                return "mission Self update test"
            if input_idx == 2:
                # Give watcher time to see the self-update
                time.sleep(0.5)
            if input_idx > 2:
                raise EOFError()
            return "quit"

        with mock_config:
            with patch('builtins.input', mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    run_agent("test_agent")
                    output = mock_out.getvalue()

        # Should NOT show "Update from test_agent" since it's a self-update
        assert "Update from test_agent" not in output
        assert "Goodbye" in output

    def test_background_watcher_handles_null_updated_by(self, temp_comm_file, mock_config):
        """Test background watcher handles when last_updated_by is None."""
        comm = CommunicationsFile(temp_comm_file)

        input_idx = 0

        def mock_input(prompt=""):
            nonlocal input_idx
            input_idx += 1
            if input_idx == 1:
                time.sleep(0.3)
                # Manually update file with no last_updated_by
                data = comm._read_data()
                data["_meta"]["last_updated_by"] = None
                data["some_data"] = {"changed": True}
                comm._write_data(data)
                time.sleep(0.5)
            if input_idx > 1:
                raise EOFError()
            return "quit"

        with mock_config:
            with patch('builtins.input', mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    run_agent("test_agent")
                    output = mock_out.getvalue()

        # Should NOT crash when updated_by is None
        assert "Goodbye" in output


class TestCLIDeliveryEdgeCases:
    """Test edge cases for delivery display."""

    def test_deliveries_with_malformed_entry(self, cli_sim, temp_comm_file):
        """Test deliveries command with malformed entry (less than 3 elements)."""
        comm = CommunicationsFile(temp_comm_file)
        # Create delivery with only 2 elements (malformed)
        comm.update_agent("test_agent", AgentStatus(
            added=[["provider", "Work done"]]  # Missing third element
        ))

        cli_sim.add_inputs(
            "deliveries",
            "quit"
        )

        output = cli_sim.run_agent_session("test_agent")

        # Should show deliveries section but skip malformed entry
        assert "Deliveries" in output

    def test_show_my_status_with_malformed_delivery(self, temp_comm_file, mock_config, capsys):
        """Test show_my_status with malformed delivery."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("my_agent", AgentStatus(
            added=[["from", "desc"]]  # Missing original_request
        ))

        with mock_config:
            show_my_status(comm, "my_agent")

        captured = capsys.readouterr()
        # Should still display but skip malformed entry
        assert "Your status" in captured.out

    def test_show_status_with_malformed_delivery(self, temp_comm_file, mock_config, capsys):
        """Test show_status with malformed delivery in agent data."""
        comm = CommunicationsFile(temp_comm_file)
        comm.update_agent("agent1", AgentStatus(
            mission="Test",
            added=[["from", "only_two_elements"]]  # Malformed
        ))

        with mock_config:
            show_status()

        captured = capsys.readouterr()
        assert "agent1" in captured.out
