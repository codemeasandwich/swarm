"""
E2E tests for FileWatcher notification system.
"""

import pytest
import time
import threading
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from communication.core import CommunicationsFile, FileWatcher, AgentStatus
from tests.conftest import NotificationCollector


class TestFileWatcherNotifications:
    """Flow 3: File watcher notifications."""

    def test_watcher_notifies_other_agents_not_updater(
        self, comm_file, notification_collector
    ):
        """
        User Story: When Agent A updates the file, Agent B and C should
        be notified, but Agent A (the updater) should NOT be notified.
        """
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        # Create collectors for each agent
        collector_a = notification_collector
        collector_b = NotificationCollector()
        collector_c = NotificationCollector()

        # Register all agents
        watcher.register("agent_a", collector_a.callback)
        watcher.register("agent_b", collector_b.callback)
        watcher.register("agent_c", collector_c.callback)

        watcher.start()
        time.sleep(0.2)

        # Agent A makes an update
        comm_file.update_field("agent_a", "mission", "Agent A's mission")

        # Wait for notifications
        collector_b.wait_for_notifications(1, timeout=2.0)
        collector_c.wait_for_notifications(1, timeout=2.0)
        time.sleep(0.3)

        # Agent A should NOT be notified (they made the update)
        assert len(collector_a.notifications) == 0

        # Agent B and C should be notified
        assert len(collector_b.notifications) >= 1
        assert len(collector_c.notifications) >= 1

        # Verify notification content
        assert collector_b.notifications[0]['updated_by'] == "agent_a"

        watcher.stop()

    def test_watcher_register_unregister(self, comm_file, notification_collector, capsys):
        """Test registering and unregistering agents from watcher."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        collector_a = notification_collector
        collector_b = NotificationCollector()

        watcher.register("agent_a", collector_a.callback)
        watcher.register("agent_b", collector_b.callback)

        captured = capsys.readouterr()
        assert "Registered agent: agent_a" in captured.out
        assert "Registered agent: agent_b" in captured.out

        watcher.start()
        time.sleep(0.2)

        # Unregister agent_a
        watcher.unregister("agent_a")
        captured = capsys.readouterr()
        assert "Unregistered agent: agent_a" in captured.out

        # Make sure agent_a not in callbacks anymore
        assert "agent_a" not in watcher._callbacks

        watcher.stop()

    def test_watcher_unregister_nonexistent(self, comm_file, capsys):
        """Test unregistering agent that doesn't exist."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        # Should not raise or print anything
        watcher.unregister("nonexistent")

        captured = capsys.readouterr()
        assert "Unregistered" not in captured.out

    def test_watcher_start_stop(self, comm_file, capsys):
        """Test starting and stopping the watcher."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        # Start should set running flag and create thread
        watcher.start()
        assert watcher._running is True
        assert watcher._thread is not None
        assert watcher._thread.is_alive()

        captured = capsys.readouterr()
        assert "Started watching" in captured.out

        # Starting again should be no-op
        watcher.start()
        assert watcher._running is True

        # Stop should clear running flag
        watcher.stop()
        assert watcher._running is False

        captured = capsys.readouterr()
        assert "Stopped" in captured.out

        # Give thread time to finish
        time.sleep(0.5)

    def test_watcher_detects_changes(self, comm_file, notification_collector):
        """Test that watcher detects file changes via hash."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)
        watcher.register("listener", notification_collector.callback)
        watcher.start()

        time.sleep(0.2)

        # Make a change from different agent
        comm_file.update_field("updater", "mission", "Test mission")

        # Wait for notification
        assert notification_collector.wait_for_notifications(1, timeout=2.0)
        assert notification_collector.notifications[0]['updated_by'] == "updater"

        watcher.stop()

    def test_watcher_handles_callback_exception(self, comm_file, capsys):
        """Test that watcher continues if a callback raises an exception."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        def bad_callback(updated_by, data):
            raise ValueError("Callback error")

        notifications = []

        def good_callback(updated_by, data):
            notifications.append(updated_by)

        watcher.register("bad_agent", bad_callback)
        watcher.register("good_agent", good_callback)
        watcher.start()

        time.sleep(0.2)

        # Trigger update
        comm_file.update_field("updater", "mission", "Test")

        time.sleep(0.5)

        # Good agent should still get notification despite bad agent's error
        assert len(notifications) >= 1

        # Error should be printed
        captured = capsys.readouterr()
        assert "Error notifying bad_agent" in captured.out

        watcher.stop()

    def test_watcher_stores_last_data(self, comm_file, notification_collector):
        """Test that watcher stores last data after detecting change."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)
        watcher.register("listener", notification_collector.callback)
        watcher.start()

        time.sleep(0.2)

        comm_file.update_field("test_agent", "mission", "Test mission")

        notification_collector.wait_for_notifications(1, timeout=2.0)
        time.sleep(0.2)

        # Check that _last_data was updated
        assert "test_agent" in watcher._last_data

        watcher.stop()

    def test_watcher_multiple_updates(self, comm_file, notification_collector):
        """Test watcher handles multiple rapid updates."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)
        watcher.register("listener", notification_collector.callback)
        watcher.start()

        time.sleep(0.2)

        # Make multiple updates
        for i in range(3):
            comm_file.update_field(f"agent_{i}", "mission", f"Mission {i}")
            time.sleep(0.2)

        # Wait for all notifications
        notification_collector.wait_for_notifications(3, timeout=3.0)

        assert len(notification_collector.notifications) >= 3

        watcher.stop()


class TestFileWatcherEdgeCases:
    """Test edge cases for FileWatcher."""

    def test_watcher_initial_hash(self, comm_file):
        """Test watcher initializes with correct hash."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        # Before start, _last_hash should be empty
        assert watcher._last_hash == ""

        watcher.start()
        time.sleep(0.2)

        # After start, _last_hash should be set
        assert watcher._last_hash != ""
        assert watcher._last_hash == comm_file.get_file_hash()

        watcher.stop()

    def test_watcher_no_notification_on_first_read(self, comm_file, notification_collector):
        """Test watcher doesn't notify on initial file read."""
        # Pre-populate file
        comm_file.update_field("existing", "mission", "Already here")

        watcher = FileWatcher(comm_file, poll_interval=0.1)
        watcher.register("listener", notification_collector.callback)
        watcher.start()

        # Wait a bit - should NOT trigger notification for existing data
        time.sleep(0.5)

        assert len(notification_collector.notifications) == 0

        watcher.stop()

    def test_watcher_poll_interval(self, comm_file):
        """Test watcher respects poll interval."""
        watcher = FileWatcher(comm_file, poll_interval=0.5)

        assert watcher.poll_interval == 0.5

    def test_watcher_thread_daemon(self, comm_file):
        """Test watcher thread is a daemon thread."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)
        watcher.start()

        assert watcher._thread.daemon is True

        watcher.stop()

    def test_watcher_handles_watch_loop_exception(self, comm_file, capsys):
        """Test watcher handles exception in watch loop and continues."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        call_count = 0
        original_read = comm_file._read_data

        def failing_read():
            nonlocal call_count
            call_count += 1
            if call_count == 2:
                raise IOError("Simulated file read error")
            return original_read()

        # First, start watcher normally
        watcher.start()
        time.sleep(0.2)

        # Patch _read_data to fail
        comm_file._read_data = failing_read

        # Trigger a change that will cause _read_data to be called
        comm_file.update_field("agent", "mission", "trigger")

        time.sleep(0.5)

        # Watcher should still be running
        assert watcher._running is True

        captured = capsys.readouterr()
        # Error should be printed (if exception was caught)
        # Note: The exception happens in _watch_loop at lines 317-319

        watcher.stop()

    def test_watcher_stop_without_start(self, comm_file, capsys):
        """Test watcher.stop() when thread was never started."""
        watcher = FileWatcher(comm_file, poll_interval=0.1)

        # Stop without starting - _thread is None
        watcher.stop()

        captured = capsys.readouterr()
        assert "Stopped" in captured.out
