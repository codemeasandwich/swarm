"""
Shared fixtures and helpers for E2E tests.
"""

import pytest
import time
import threading
import sys
from pathlib import Path
from io import StringIO
from unittest.mock import patch

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from communication.core import (
    AgentStatus, CommunicationsFile, FileWatcher, Agent,
    Coordinator, TaskAgent
)
from auth import _users_db


@pytest.fixture
def temp_comm_file(tmp_path):
    """Create a temporary communications.json file path."""
    filepath = tmp_path / "communications.json"
    return str(filepath)


@pytest.fixture
def comm_file(temp_comm_file):
    """Create a CommunicationsFile instance with temp file."""
    return CommunicationsFile(temp_comm_file)


@pytest.fixture
def watcher(comm_file):
    """Create a FileWatcher instance."""
    watcher = FileWatcher(comm_file, poll_interval=0.1)
    yield watcher
    watcher.stop()


@pytest.fixture
def coordinator(temp_comm_file):
    """Create a Coordinator instance with temp file."""
    coord = Coordinator(temp_comm_file)
    coord.start()
    yield coord
    coord.stop()


@pytest.fixture
def two_agents(coordinator):
    """Create two TaskAgents for request/response testing."""
    agent_a = coordinator.create_agent(TaskAgent, "agent_a")
    agent_b = coordinator.create_agent(TaskAgent, "agent_b")
    time.sleep(0.2)  # Allow watcher to initialize
    return agent_a, agent_b


@pytest.fixture
def reset_auth_db():
    """Reset the auth module's user database between tests."""
    _users_db.clear()
    yield
    _users_db.clear()


class NotificationCollector:
    """Collect notifications from file watcher for assertions."""

    def __init__(self):
        self.notifications = []
        self.lock = threading.Lock()

    def callback(self, updated_by: str, data: dict):
        with self.lock:
            self.notifications.append({
                'updated_by': updated_by,
                'data': data.copy(),
                'timestamp': time.time()
            })

    def wait_for_notifications(self, count: int, timeout: float = 5.0):
        """Wait until we have at least `count` notifications."""
        start = time.time()
        while time.time() - start < timeout:
            with self.lock:
                if len(self.notifications) >= count:
                    return True
            time.sleep(0.1)
        return False

    def clear(self):
        with self.lock:
            self.notifications.clear()


@pytest.fixture
def notification_collector():
    """Create a notification collector for watcher tests."""
    return NotificationCollector()


class CLISimulator:
    """Simulate CLI input/output for testing."""

    def __init__(self, comm_file_path):
        self.comm_file_path = comm_file_path
        self.inputs = []
        self.input_index = 0

    def add_inputs(self, *commands):
        self.inputs.extend(commands)

    def mock_input(self, prompt=""):
        if self.input_index >= len(self.inputs):
            raise EOFError()
        cmd = self.inputs[self.input_index]
        self.input_index += 1
        return cmd

    def run_agent_session(self, agent_name):
        """Run an agent session with mocked input."""
        from cli.main import run_agent
        from config import AgentConfig, reset_config
        import config

        # Reset config and create a custom one with our temp file
        reset_config()
        test_config = AgentConfig(comm_file=self.comm_file_path)
        with patch.object(config, '_config', test_config):
            with patch('builtins.input', self.mock_input):
                with patch('sys.stdout', new_callable=StringIO) as mock_out:
                    run_agent(agent_name)
                    return mock_out.getvalue()


@pytest.fixture
def cli_sim(temp_comm_file):
    """Create a CLI simulator."""
    return CLISimulator(temp_comm_file)


@pytest.fixture
def mock_config(temp_comm_file):
    """Create a mock config fixture that patches the config module.

    Usage:
        def test_something(mock_config, temp_comm_file):
            with mock_config:
                # code that uses get_config() will get temp_comm_file
                run_watcher()
    """
    from config import AgentConfig, reset_config
    import config

    class ConfigPatcher:
        def __enter__(self):
            reset_config()
            self.test_config = AgentConfig(comm_file=temp_comm_file)
            self.patcher = patch.object(config, '_config', self.test_config)
            self.patcher.__enter__()
            return self.test_config

        def __exit__(self, *args):
            self.patcher.__exit__(*args)
            reset_config()

    return ConfigPatcher()
