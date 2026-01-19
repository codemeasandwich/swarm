"""
E2E tests for multi-agent communication flows.
Tests real user/developer workflows through the public API.
"""

import pytest
import time
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from agent_comm import (
    AgentStatus, CommunicationsFile, FileWatcher,
    Agent, Coordinator, TaskAgent
)


class TestBasicRequestResponse:
    """Flow 1: Basic request/response between two agents."""

    def test_complete_request_response_workflow(self, coordinator, capsys):
        """
        User Story: As a developer, I want Agent A to request work from
        Agent B and receive the completed delivery.
        """
        # Create two agents
        researcher = coordinator.create_agent(TaskAgent, "researcher")
        coder = coordinator.create_agent(TaskAgent, "coder")
        time.sleep(0.3)

        # Step 1: Agent A sets mission
        researcher.set_mission("Get API implementation")

        # Verify mission was set
        status = coordinator.comm_file.get_agent("researcher")
        assert status.mission == "Get API implementation"

        # Step 2: Agent A sends request to Agent B
        researcher.request("coder", "Implement auth API")

        # Verify request appears in researcher's requests array
        status = coordinator.comm_file.get_agent("researcher")
        assert len(status.requests) == 1
        assert status.requests[0] == ["coder", "Implement auth API"]

        time.sleep(0.3)  # Allow watcher to detect

        # Step 3: Agent B sees request directed at them
        requests = coder.get_pending_requests()
        assert len(requests) == 1
        assert requests[0] == ("researcher", "Implement auth API")

        # Step 4: Agent B completes request with delivery
        coder.set_working_on("Implementing auth API")
        coder.complete_request(
            requesting_agent="researcher",
            original_request="Implement auth API",
            description="Auth API implemented in auth.py"
        )

        time.sleep(0.3)

        # Step 5: Agent A receives delivery
        deliveries = researcher.get_my_deliveries()
        assert len(deliveries) == 1
        assert deliveries[0][0] == "coder"  # from_agent
        assert deliveries[0][1] == "Auth API implemented in auth.py"  # description
        assert deliveries[0][2] == "Implement auth API"  # original_request

        # Verify request was removed from researcher's requests
        status = coordinator.comm_file.get_agent("researcher")
        assert len(status.requests) == 0

        # Step 6: Agent A acknowledges delivery
        researcher.acknowledge_deliveries()

        # Verify added array is cleared
        status = coordinator.comm_file.get_agent("researcher")
        assert len(status.added) == 0

        # Cleanup
        researcher.shutdown()
        coder.shutdown()

    def test_agent_status_fields(self, coordinator):
        """Test all agent status field setters."""
        agent = coordinator.create_agent(TaskAgent, "test_agent")
        time.sleep(0.2)

        # Test set_mission
        agent.set_mission("Test mission")
        assert coordinator.comm_file.get_agent("test_agent").mission == "Test mission"

        # Test set_working_on
        agent.set_working_on("Current task")
        assert coordinator.comm_file.get_agent("test_agent").working_on == "Current task"

        # Test set_done
        agent.set_done("Completed task")
        assert coordinator.comm_file.get_agent("test_agent").done == "Completed task"

        # Test set_next
        agent.set_next("Next task")
        assert coordinator.comm_file.get_agent("test_agent").next == "Next task"

        agent.shutdown()

    def test_update_all_multiple_fields(self, coordinator):
        """Test updating multiple fields at once."""
        agent = coordinator.create_agent(TaskAgent, "multi_agent")
        time.sleep(0.2)

        agent.update_all(
            mission="Multi mission",
            working_on="Multi working",
            done="Multi done",
            next_task="Multi next"
        )

        status = coordinator.comm_file.get_agent("multi_agent")
        assert status.mission == "Multi mission"
        assert status.working_on == "Multi working"
        assert status.done == "Multi done"
        assert status.next == "Multi next"

        # Test partial update (only mission, others should stay)
        agent.update_all(mission="Updated mission only")
        status = coordinator.comm_file.get_agent("multi_agent")
        assert status.mission == "Updated mission only"
        assert status.working_on == "Multi working"  # Unchanged

        agent.shutdown()

    def test_update_all_no_fields(self, coordinator):
        """Test update_all with no fields specified."""
        agent = coordinator.create_agent(TaskAgent, "empty_update")
        time.sleep(0.2)

        # Set initial values
        agent.set_mission("Initial mission")

        # Call update_all with no args - nothing changes
        agent.update_all()

        status = coordinator.comm_file.get_agent("empty_update")
        assert status.mission == "Initial mission"

        agent.shutdown()

    def test_update_all_only_done(self, coordinator):
        """Test update_all with only done field."""
        agent = coordinator.create_agent(TaskAgent, "done_only")
        time.sleep(0.2)

        agent.update_all(done="Completed task")

        status = coordinator.comm_file.get_agent("done_only")
        assert status.done == "Completed task"
        assert status.mission == ""  # Default
        assert status.working_on == ""  # Default

        agent.shutdown()

    def test_update_all_only_next(self, coordinator):
        """Test update_all with only next_task field."""
        agent = coordinator.create_agent(TaskAgent, "next_only")
        time.sleep(0.2)

        agent.update_all(next_task="Future task")

        status = coordinator.comm_file.get_agent("next_only")
        assert status.next == "Future task"

        agent.shutdown()

    def test_get_other_agents(self, coordinator):
        """Test viewing status of other agents."""
        agent_a = coordinator.create_agent(TaskAgent, "viewer")
        agent_b = coordinator.create_agent(TaskAgent, "target")
        time.sleep(0.2)

        agent_b.set_mission("Target's mission")

        others = agent_a.get_other_agents()
        assert "target" in others
        assert "viewer" not in others
        assert others["target"].mission == "Target's mission"

        agent_a.shutdown()
        agent_b.shutdown()

    def test_get_agent_status_specific(self, coordinator):
        """Test getting a specific agent's status."""
        agent = coordinator.create_agent(TaskAgent, "status_test")
        time.sleep(0.2)

        agent.set_working_on("Specific work")

        # Get via agent method
        status = agent.get_agent_status("status_test")
        assert status.working_on == "Specific work"

        # Get non-existent agent
        no_status = agent.get_agent_status("nonexistent")
        assert no_status is None

        agent.shutdown()


class TestBlockingOnMultipleDependencies:
    """Flow 2: Blocking on multiple dependencies."""

    def test_agent_blocked_until_all_deliveries_received(self, coordinator):
        """
        User Story: As a builder agent, I need 2 deliveries from designer
        before I can proceed. I remain blocked until BOTH arrive.
        """
        builder = coordinator.create_agent(TaskAgent, "builder")
        designer = coordinator.create_agent(TaskAgent, "designer")
        time.sleep(0.3)

        # Builder sends 2 requests
        builder.set_mission("Build user management app")
        builder.request("designer", "Need database schema")
        builder.request("designer", "Need API spec")
        builder.set_working_on("BLOCKED - waiting for 2 tasks")

        # Verify 2 requests sent
        status = coordinator.comm_file.get_agent("builder")
        assert len(status.requests) == 2

        # Designer sees both requests
        requests = designer.get_pending_requests()
        assert len(requests) == 2

        # Designer completes FIRST task
        designer.complete_request(
            requesting_agent="builder",
            original_request="Need database schema",
            description="Schema: users(id, email, hash)"
        )

        time.sleep(0.2)

        # Builder checks - should have 1 delivery, still 1 pending request
        deliveries = builder.get_my_deliveries()
        assert len(deliveries) == 1

        status = coordinator.comm_file.get_agent("builder")
        assert len(status.requests) == 1  # Still waiting for API spec

        # Designer completes SECOND task
        designer.complete_request(
            requesting_agent="builder",
            original_request="Need API spec",
            description="API: GET/POST/PUT/DELETE /users"
        )

        time.sleep(0.2)

        # Builder now has BOTH deliveries
        deliveries = builder.get_my_deliveries()
        assert len(deliveries) == 2

        # No more pending requests
        status = coordinator.comm_file.get_agent("builder")
        assert len(status.requests) == 0

        # Builder can acknowledge and proceed
        builder.acknowledge_deliveries()
        builder.set_working_on("Building app with schema and API spec")

        deliveries = builder.get_my_deliveries()
        assert len(deliveries) == 0

        builder.shutdown()
        designer.shutdown()

    def test_multiple_requests_to_same_agent(self, coordinator):
        """Test sending multiple requests to the same agent."""
        requester = coordinator.create_agent(TaskAgent, "requester")
        provider = coordinator.create_agent(TaskAgent, "provider")
        time.sleep(0.2)

        # Send 3 requests
        requester.request("provider", "Task 1")
        requester.request("provider", "Task 2")
        requester.request("provider", "Task 3")

        status = coordinator.comm_file.get_agent("requester")
        assert len(status.requests) == 3

        pending = provider.get_pending_requests()
        assert len(pending) == 3

        requester.shutdown()
        provider.shutdown()


class TestCommunicationsFileMethods:
    """Test CommunicationsFile methods through realistic scenarios."""

    def test_file_creation_on_init(self, tmp_path):
        """Test file is created if it doesn't exist."""
        filepath = tmp_path / "new_file.json"
        assert not filepath.exists()

        comm = CommunicationsFile(str(filepath))

        assert filepath.exists()
        with open(filepath) as f:
            data = json.load(f)
        assert "_meta" in data
        assert data["_meta"]["version"] == "1.0"

    def test_nested_directory_creation(self, tmp_path):
        """Test nested directories are created."""
        filepath = tmp_path / "nested" / "deep" / "comm.json"
        comm = CommunicationsFile(str(filepath))
        assert filepath.exists()

    def test_get_all_agents_empty(self, comm_file):
        """Test get_all_agents when no agents exist."""
        agents = comm_file.get_all_agents()
        assert agents == {}

    def test_get_agent_nonexistent(self, comm_file):
        """Test get_agent returns None for nonexistent agent."""
        result = comm_file.get_agent("nonexistent")
        assert result is None

    def test_update_field_creates_agent(self, comm_file):
        """Test update_field creates agent if doesn't exist."""
        comm_file.update_field("new_agent", "mission", "New mission")

        status = comm_file.get_agent("new_agent")
        assert status.mission == "New mission"

    def test_add_request_creates_agent(self, comm_file):
        """Test add_request creates agent if doesn't exist."""
        comm_file.add_request("new_requester", "target", "Request text")

        status = comm_file.get_agent("new_requester")
        assert len(status.requests) == 1

    def test_add_request_initializes_requests_array(self, comm_file):
        """Test add_request initializes requests array if missing."""
        # First create agent without requests field
        comm_file.update_field("agent_no_reqs", "mission", "Test")
        # Manually remove requests to simulate edge case
        data = comm_file._read_data()
        if "requests" in data.get("agent_no_reqs", {}):
            del data["agent_no_reqs"]["requests"]
        comm_file._write_data(data)

        # Now add request - should create requests array
        comm_file.add_request("agent_no_reqs", "other", "A request")

        status = comm_file.get_agent("agent_no_reqs")
        assert len(status.requests) == 1

    def test_remove_request(self, comm_file):
        """Test removing a specific request."""
        comm_file.add_request("agent_a", "agent_b", "Request 1")
        comm_file.add_request("agent_a", "agent_b", "Request 2")

        comm_file.remove_request("agent_a", "agent_b", "Request 1")

        status = comm_file.get_agent("agent_a")
        assert len(status.requests) == 1
        assert status.requests[0][1] == "Request 2"

    def test_remove_request_nonexistent_agent(self, comm_file):
        """Test remove_request with nonexistent agent doesn't error."""
        # Should not raise
        comm_file.remove_request("nonexistent", "other", "req")

    def test_remove_agent(self, comm_file):
        """Test removing an agent entirely."""
        comm_file.update_field("to_remove", "mission", "Temporary")

        comm_file.remove_agent("to_remove")

        assert comm_file.get_agent("to_remove") is None

    def test_remove_agent_nonexistent(self, comm_file):
        """Test remove_agent with nonexistent agent doesn't error."""
        # Should not raise
        comm_file.remove_agent("nonexistent")

    def test_get_file_hash_changes(self, comm_file):
        """Test file hash changes when content changes."""
        hash1 = comm_file.get_file_hash()

        comm_file.update_field("agent", "mission", "New")

        hash2 = comm_file.get_file_hash()
        assert hash1 != hash2

    def test_clear_added_no_agent(self, comm_file):
        """Test clear_added when agent doesn't exist (no error)."""
        # Should not raise
        comm_file.clear_added("nonexistent")

    def test_clear_added_existing_agent(self, comm_file):
        """Test clear_added clears the added array."""
        comm_file.update_agent("agent", AgentStatus(
            added=[["from", "desc", "orig"]]
        ))

        comm_file.clear_added("agent")

        status = comm_file.get_agent("agent")
        assert len(status.added) == 0

    def test_complete_request_creates_requesting_agent(self, comm_file):
        """Test complete_request creates requesting_agent if needed."""
        comm_file.complete_request(
            completing_agent="completer",
            requesting_agent="requester",
            original_request="The request",
            description="Done"
        )

        status = comm_file.get_agent("requester")
        assert len(status.added) == 1

    def test_complete_request_initializes_added_array(self, comm_file):
        """Test complete_request initializes added array if missing."""
        # Create agent without added field
        comm_file.update_field("req_agent", "mission", "Test")
        data = comm_file._read_data()
        if "added" in data.get("req_agent", {}):
            del data["req_agent"]["added"]
        comm_file._write_data(data)

        comm_file.complete_request(
            completing_agent="completer",
            requesting_agent="req_agent",
            original_request="Request",
            description="Done"
        )

        status = comm_file.get_agent("req_agent")
        assert len(status.added) == 1

    def test_complete_request_removes_from_requests(self, comm_file):
        """Test complete_request removes the original request."""
        comm_file.add_request("requester", "completer", "Do this task")

        comm_file.complete_request(
            completing_agent="completer",
            requesting_agent="requester",
            original_request="Do this task",
            description="Task done"
        )

        status = comm_file.get_agent("requester")
        assert len(status.requests) == 0
        assert len(status.added) == 1

    def test_complete_request_no_requests_key(self, comm_file):
        """Test complete_request when agent exists but has no requests key."""
        # Create agent without requests key
        comm_file.update_field("requester", "mission", "Test mission")

        # Remove the requests key manually
        data = comm_file._read_data()
        if "requests" in data.get("requester", {}):
            del data["requester"]["requests"]
        comm_file._write_data(data)

        # Complete a request - should not fail even with no requests key
        comm_file.complete_request(
            completing_agent="completer",
            requesting_agent="requester",
            original_request="Nonexistent request",
            description="Completed anyway"
        )

        status = comm_file.get_agent("requester")
        # Should have the delivery even though request wasn't found
        assert len(status.added) == 1

    def test_meta_update(self, comm_file):
        """Test metadata is updated correctly."""
        comm_file.update_field("agent_x", "mission", "Test")

        data = comm_file._read_data()
        assert data["_meta"]["last_updated_by"] == "agent_x"
        assert data["_meta"]["last_updated"] is not None

    def test_get_requests_for_agent_skips_meta(self, comm_file):
        """Test get_requests_for_agent skips _meta key."""
        comm_file.add_request("sender", "target", "A request")

        requests = comm_file.get_requests_for_agent("target")
        assert len(requests) == 1
        assert requests[0] == ("sender", "A request")

    def test_get_requests_for_agent_handles_non_dict(self, comm_file):
        """Test get_requests_for_agent handles non-dict values gracefully."""
        # Add a normal request first
        comm_file.add_request("sender", "target", "A request")

        requests = comm_file.get_requests_for_agent("target")
        assert len(requests) == 1

    def test_get_requests_for_agent_filters_malformed(self, comm_file):
        """Test get_requests_for_agent filters malformed requests."""
        # Create request with less than 2 elements
        comm_file.update_agent("bad_agent", AgentStatus(
            requests=[["target"]]  # Missing request text
        ))

        requests = comm_file.get_requests_for_agent("target")
        assert len(requests) == 0  # Malformed request filtered out


class TestAgentStatusDataclass:
    """Test AgentStatus dataclass methods."""

    def test_to_dict(self):
        """Test AgentStatus.to_dict()."""
        status = AgentStatus(
            mission="Test mission",
            working_on="Task",
            done="Completed",
            next="Next task",
            requests=[["agent", "request"]],
            added=[["from", "desc", "orig"]],
            last_updated="2024-01-01"
        )

        d = status.to_dict()
        assert d["mission"] == "Test mission"
        assert d["working_on"] == "Task"
        assert d["done"] == "Completed"
        assert d["next"] == "Next task"
        assert d["requests"] == [["agent", "request"]]
        assert d["added"] == [["from", "desc", "orig"]]
        assert d["last_updated"] == "2024-01-01"

    def test_from_dict(self):
        """Test AgentStatus.from_dict()."""
        data = {
            "mission": "From dict mission",
            "working_on": "From dict working",
            "requests": [["a", "b"]]
        }

        status = AgentStatus.from_dict(data)
        assert status.mission == "From dict mission"
        assert status.working_on == "From dict working"
        assert status.requests == [["a", "b"]]
        assert status.done == ""  # Default
        assert status.next == ""  # Default
        assert status.added == []  # Default

    def test_from_dict_empty(self):
        """Test AgentStatus.from_dict() with empty dict."""
        status = AgentStatus.from_dict({})
        assert status.mission == ""
        assert status.working_on == ""
        assert status.done == ""
        assert status.next == ""
        assert status.requests == []
        assert status.added == []
        assert status.last_updated == ""

    def test_default_values(self):
        """Test AgentStatus default values."""
        status = AgentStatus()
        assert status.mission == ""
        assert status.working_on == ""
        assert status.done == ""
        assert status.next == ""
        assert status.requests == []
        assert status.added == []
        assert status.last_updated == ""


class TestCoordinatorMethods:
    """Test Coordinator class methods."""

    def test_coordinator_start_stop(self, temp_comm_file, capsys):
        """Test coordinator start and stop."""
        coord = Coordinator(temp_comm_file)
        coord.start()

        captured = capsys.readouterr()
        assert "System started" in captured.out

        coord.stop()
        captured = capsys.readouterr()
        assert "System stopped" in captured.out

    def test_coordinator_get_agent(self, coordinator):
        """Test get_agent returns created agents."""
        agent = coordinator.create_agent(TaskAgent, "test")

        retrieved = coordinator.get_agent("test")
        assert retrieved is agent

        # Non-existent returns None
        assert coordinator.get_agent("nonexistent") is None

        agent.shutdown()

    def test_coordinator_get_all_status(self, coordinator):
        """Test get_all_status returns all agent statuses."""
        agent1 = coordinator.create_agent(TaskAgent, "agent1")
        agent2 = coordinator.create_agent(TaskAgent, "agent2")
        time.sleep(0.2)

        agent1.set_mission("Mission 1")
        agent2.set_mission("Mission 2")

        all_status = coordinator.get_all_status()
        assert "agent1" in all_status
        assert "agent2" in all_status
        assert all_status["agent1"].mission == "Mission 1"
        assert all_status["agent2"].mission == "Mission 2"

        agent1.shutdown()
        agent2.shutdown()


class TestAgentCallbacks:
    """Test Agent callback methods."""

    def test_on_deliveries_with_malformed_data(self, coordinator, capsys):
        """Test on_deliveries handles malformed delivery data gracefully."""
        agent = coordinator.create_agent(TaskAgent, "test_agent")
        time.sleep(0.2)

        # Simulate malformed deliveries (less than 3 elements)
        malformed_deliveries = [
            ["from_agent", "description"],  # Missing original_request
            ["only_one"],  # Only one element
        ]

        # Call on_deliveries directly
        agent.on_deliveries(malformed_deliveries)

        captured = capsys.readouterr()
        # Should not crash, and should skip malformed entries
        # The default on_deliveries only prints if len(delivery) >= 3
        assert "Delivery from" not in captured.out

        agent.shutdown()

    def test_on_deliveries_with_valid_data(self, coordinator, capsys):
        """Test on_deliveries prints valid deliveries."""
        agent = coordinator.create_agent(TaskAgent, "test_agent")
        time.sleep(0.2)

        valid_deliveries = [
            ["from_agent", "Work completed", "Original request"]
        ]

        agent.on_deliveries(valid_deliveries)

        captured = capsys.readouterr()
        assert "Delivery from from_agent" in captured.out
        assert "Work completed" in captured.out
        assert "Original request" in captured.out

        agent.shutdown()

    def test_on_new_requests_prints_requests(self, coordinator, capsys):
        """Test on_new_requests prints incoming requests."""
        agent = coordinator.create_agent(TaskAgent, "test_agent")
        time.sleep(0.2)

        requests = [
            ("requester1", "Please do task 1"),
            ("requester2", "Please do task 2"),
        ]

        agent.on_new_requests(requests)

        captured = capsys.readouterr()
        assert "Request from requester1" in captured.out
        assert "Please do task 1" in captured.out
        assert "Request from requester2" in captured.out
        assert "Please do task 2" in captured.out

        agent.shutdown()

    def test_agent_update_triggers_callbacks(self, coordinator, capsys):
        """Test that file updates trigger agent callbacks."""
        agent1 = coordinator.create_agent(TaskAgent, "agent1")
        agent2 = coordinator.create_agent(TaskAgent, "agent2")
        time.sleep(0.3)

        # Agent1 makes an update
        agent1.set_working_on("Working on something")

        # Wait for watcher to notify agent2
        time.sleep(0.5)

        captured = capsys.readouterr()
        # TaskAgent's on_communication_update prints update info
        assert "Update from agent1" in captured.out or "agent1" in captured.out

        agent1.shutdown()
        agent2.shutdown()
