"""Terminal process management for agent subprocesses."""

from __future__ import annotations

import logging
import os
import subprocess
import threading
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Dict, List

logger = logging.getLogger(__name__)


@dataclass
class AgentProcess:
    """Represents a running agent subprocess."""
    agent_id: str
    process: subprocess.Popen
    working_dir: Path
    started_at: datetime = field(default_factory=datetime.now)
    output_lines: List[str] = field(default_factory=list)
    error_lines: List[str] = field(default_factory=list)

    @property
    def pid(self) -> Optional[int]:
        return self.process.pid if self.process else None

    @property
    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    @property
    def return_code(self) -> Optional[int]:
        if self.process:
            return self.process.poll()
        return None

    def send_input(self, text: str):
        """Send input to the process stdin."""
        if self.process and self.process.stdin:
            try:
                self.process.stdin.write(text + "\n")
                self.process.stdin.flush()
            except (BrokenPipeError, OSError) as e:
                logger.error(f"Failed to send input to {self.agent_id}: {e}")

    def terminate(self, timeout: float = 5.0):
        """Gracefully terminate the process."""
        if not self.process:
            return

        try:
            self.process.terminate()
            self.process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            logger.warning(f"Process {self.agent_id} didn't terminate, killing")
            self.process.kill()
            self.process.wait(timeout=2.0)

    def kill(self):
        """Forcefully kill the process."""
        if self.process:
            self.process.kill()
            self.process.wait(timeout=2.0)


class TerminalManager:
    """Manages terminal processes for agents."""

    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self._processes: Dict[str, AgentProcess] = {}
        self._output_threads: Dict[str, threading.Thread] = {}
        self._callbacks: Dict[str, List[Callable[[str, str], None]]] = {}
        self._lock = threading.Lock()

    def spawn_claude_agent(
        self,
        agent_id: str,
        prompt: str,
        working_dir: Optional[Path] = None,
        timeout: int = 300,
        dangerously_skip_permissions: bool = True,
    ) -> AgentProcess:
        """
        Spawn a Claude Code CLI agent.

        Args:
            agent_id: Unique identifier for this agent
            prompt: The initial prompt for Claude
            working_dir: Working directory for the agent
            timeout: Timeout in seconds
            dangerously_skip_permissions: Skip permission prompts

        Returns:
            AgentProcess instance
        """
        working_dir = working_dir or self.base_dir / "sandbox"
        working_dir = Path(working_dir)
        working_dir.mkdir(parents=True, exist_ok=True)

        cmd = ["claude", "--print"]
        if dangerously_skip_permissions:
            cmd.append("--dangerously-skip-permissions")
        cmd.extend(["-p", prompt])

        logger.info(f"Spawning agent {agent_id} in {working_dir}")

        process = subprocess.Popen(
            cmd,
            cwd=str(working_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=1,
        )

        agent_process = AgentProcess(
            agent_id=agent_id,
            process=process,
            working_dir=working_dir,
        )

        with self._lock:
            self._processes[agent_id] = agent_process

        # Start output reader thread
        self._start_output_reader(agent_id, agent_process)

        return agent_process

    def spawn_shell(
        self,
        agent_id: str,
        command: str,
        working_dir: Optional[Path] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> AgentProcess:
        """
        Spawn a shell process for an agent.

        Args:
            agent_id: Unique identifier for this agent
            command: The shell command to run
            working_dir: Working directory
            env: Environment variables

        Returns:
            AgentProcess instance
        """
        working_dir = working_dir or self.base_dir / "sandbox"
        working_dir = Path(working_dir)
        working_dir.mkdir(parents=True, exist_ok=True)

        process_env = os.environ.copy()
        if env:
            process_env.update(env)

        logger.info(f"Spawning shell for {agent_id}: {command}")

        process = subprocess.Popen(
            command,
            shell=True,
            cwd=str(working_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=process_env,
        )

        agent_process = AgentProcess(
            agent_id=agent_id,
            process=process,
            working_dir=working_dir,
        )

        with self._lock:
            self._processes[agent_id] = agent_process

        self._start_output_reader(agent_id, agent_process)

        return agent_process

    def _start_output_reader(self, agent_id: str, agent_process: AgentProcess):
        """Start a thread to read process output."""
        def reader():
            while agent_process.is_running:
                try:
                    line = agent_process.process.stdout.readline()
                    if line:
                        agent_process.output_lines.append(line.rstrip())
                        self._notify_output(agent_id, "stdout", line.rstrip())
                except Exception as e:
                    logger.error(f"Error reading stdout for {agent_id}: {e}")
                    break

            # Read any remaining stderr
            try:
                stderr = agent_process.process.stderr.read()
                if stderr:
                    for line in stderr.splitlines():
                        agent_process.error_lines.append(line)
                        self._notify_output(agent_id, "stderr", line)
            except Exception as e:
                logger.error(f"Error reading stderr for {agent_id}: {e}")

        thread = threading.Thread(target=reader, daemon=True)
        thread.start()

        with self._lock:
            self._output_threads[agent_id] = thread

    def _notify_output(self, agent_id: str, stream: str, line: str):
        """Notify registered callbacks of output."""
        callbacks = self._callbacks.get(agent_id, [])
        for callback in callbacks:
            try:
                callback(stream, line)
            except Exception as e:
                logger.error(f"Callback error for {agent_id}: {e}")

    def register_output_callback(
        self,
        agent_id: str,
        callback: Callable[[str, str], None]
    ):
        """Register a callback for agent output."""
        with self._lock:
            if agent_id not in self._callbacks:
                self._callbacks[agent_id] = []
            self._callbacks[agent_id].append(callback)

    def get_process(self, agent_id: str) -> Optional[AgentProcess]:
        """Get an agent's process."""
        with self._lock:
            return self._processes.get(agent_id)

    def get_output(self, agent_id: str) -> List[str]:
        """Get all stdout output for an agent."""
        process = self.get_process(agent_id)
        return process.output_lines if process else []

    def get_errors(self, agent_id: str) -> List[str]:
        """Get all stderr output for an agent."""
        process = self.get_process(agent_id)
        return process.error_lines if process else []

    def is_running(self, agent_id: str) -> bool:
        """Check if an agent's process is still running."""
        process = self.get_process(agent_id)
        return process.is_running if process else False

    def wait_for_completion(
        self,
        agent_id: str,
        timeout: Optional[float] = None
    ) -> Optional[int]:
        """
        Wait for an agent's process to complete.

        Args:
            agent_id: The agent ID
            timeout: Timeout in seconds

        Returns:
            Return code, or None if timeout
        """
        process = self.get_process(agent_id)
        if not process or not process.process:
            return None

        try:
            return process.process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            return None

    def terminate(self, agent_id: str, timeout: float = 5.0):
        """Terminate an agent's process."""
        process = self.get_process(agent_id)
        if process:
            process.terminate(timeout)
            with self._lock:
                if agent_id in self._processes:
                    del self._processes[agent_id]
                if agent_id in self._output_threads:
                    del self._output_threads[agent_id]

    def terminate_all(self, timeout: float = 5.0):
        """Terminate all agent processes."""
        with self._lock:
            agent_ids = list(self._processes.keys())

        for agent_id in agent_ids:
            self.terminate(agent_id, timeout)

    def get_all_agents(self) -> List[str]:
        """Get list of all agent IDs."""
        with self._lock:
            return list(self._processes.keys())

    def get_running_agents(self) -> List[str]:
        """Get list of running agent IDs."""
        with self._lock:
            return [
                agent_id for agent_id, process in self._processes.items()
                if process.is_running
            ]
