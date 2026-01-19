"""CI event types and event emitter."""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Callable, Awaitable, List, Optional, Dict, Any
import asyncio
import uuid
import logging

from .interface import CIEvent

logger = logging.getLogger(__name__)


class CIEventType(Enum):
    """Types of CI events."""
    BUILD_STARTED = "build_started"
    BUILD_SUCCESS = "build_success"
    BUILD_FAILURE = "build_failure"
    BUILD_CANCELLED = "build_cancelled"
    PR_CREATED = "pr_created"
    PR_APPROVED = "pr_approved"
    PR_MERGED = "pr_merged"
    PR_CLOSED = "pr_closed"
    PR_CHECKS_PASSED = "pr_checks_passed"
    PR_CHECKS_FAILED = "pr_checks_failed"


class CIEventEmitter:
    """
    Event emitter for CI events.

    Allows components to subscribe to and emit CI events
    for coordination between agents and the orchestrator.
    """

    def __init__(self):
        self._subscribers: List[Callable[[CIEvent], Awaitable[None]]] = []
        self._event_history: List[CIEvent] = []
        self._max_history = 1000
        self._filters: Dict[Callable, Dict[str, Any]] = {}

    async def subscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]],
        event_types: Optional[List[CIEventType]] = None,
        branches: Optional[List[str]] = None,
        agent_ids: Optional[List[str]] = None,
    ):
        """
        Subscribe to CI events with optional filters.

        Args:
            callback: Async function to call when matching events occur
            event_types: Only receive these event types (None = all)
            branches: Only receive events for these branches (None = all)
            agent_ids: Only receive events for these agents (None = all)
        """
        self._subscribers.append(callback)
        self._filters[callback] = {
            "event_types": [et.value for et in event_types] if event_types else None,
            "branches": branches,
            "agent_ids": agent_ids,
        }
        logger.debug(f"Subscribed callback with filters: {self._filters[callback]}")

    async def unsubscribe(self, callback: Callable[[CIEvent], Awaitable[None]]):
        """Unsubscribe from CI events."""
        if callback in self._subscribers:
            self._subscribers.remove(callback)
            if callback in self._filters:
                del self._filters[callback]
            logger.debug("Unsubscribed callback")

    def _matches_filter(self, event: CIEvent, callback: Callable) -> bool:
        """Check if an event matches a subscriber's filters."""
        filters = self._filters.get(callback, {})

        # Check event type filter
        event_types = filters.get("event_types")
        if event_types and event.event_type not in event_types:
            return False

        # Check branch filter
        branches = filters.get("branches")
        if branches and event.branch not in branches:
            return False

        # Check agent filter
        agent_ids = filters.get("agent_ids")
        if agent_ids and event.agent_id not in agent_ids:
            return False

        return True

    async def emit(self, event: CIEvent):
        """
        Emit a CI event to all matching subscribers.

        Args:
            event: The event to emit
        """
        # Record in history
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]

        logger.info(f"Emitting CI event: {event.event_type} for {event.branch}")

        # Notify matching subscribers
        for callback in self._subscribers:
            if self._matches_filter(event, callback):
                try:
                    await callback(event)
                except Exception as e:
                    logger.error(f"Error in event callback: {e}")

    async def emit_build_success(
        self,
        branch: str,
        run_id: str,
        agent_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ):
        """Emit a build success event."""
        event = CIEvent(
            event_id=str(uuid.uuid4()),
            event_type=CIEventType.BUILD_SUCCESS.value,
            branch=branch,
            run_id=run_id,
            agent_id=agent_id,
            payload=payload or {},
        )
        await self.emit(event)

    async def emit_build_failure(
        self,
        branch: str,
        run_id: str,
        agent_id: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Emit a build failure event."""
        event = CIEvent(
            event_id=str(uuid.uuid4()),
            event_type=CIEventType.BUILD_FAILURE.value,
            branch=branch,
            run_id=run_id,
            agent_id=agent_id,
            payload={"error_message": error_message} if error_message else {},
        )
        await self.emit(event)

    async def emit_pr_merged(
        self,
        branch: str,
        pr_number: int,
        agent_id: Optional[str] = None,
    ):
        """Emit a PR merged event."""
        event = CIEvent(
            event_id=str(uuid.uuid4()),
            event_type=CIEventType.PR_MERGED.value,
            branch=branch,
            pr_number=pr_number,
            agent_id=agent_id,
        )
        await self.emit(event)

    async def emit_pr_checks_passed(
        self,
        branch: str,
        pr_number: int,
        agent_id: Optional[str] = None,
    ):
        """Emit a PR checks passed event."""
        event = CIEvent(
            event_id=str(uuid.uuid4()),
            event_type=CIEventType.PR_CHECKS_PASSED.value,
            branch=branch,
            pr_number=pr_number,
            agent_id=agent_id,
        )
        await self.emit(event)

    def get_recent_events(
        self,
        count: int = 10,
        event_type: Optional[CIEventType] = None,
        branch: Optional[str] = None,
    ) -> List[CIEvent]:
        """
        Get recent events from history.

        Args:
            count: Number of events to return
            event_type: Filter by event type
            branch: Filter by branch

        Returns:
            List of matching events, most recent first
        """
        events = self._event_history.copy()
        events.reverse()

        if event_type:
            events = [e for e in events if e.event_type == event_type.value]

        if branch:
            events = [e for e in events if e.branch == branch]

        return events[:count]

    def get_events_since(
        self,
        since: datetime,
        event_type: Optional[CIEventType] = None,
    ) -> List[CIEvent]:
        """Get events since a given time."""
        events = [e for e in self._event_history if e.timestamp >= since]

        if event_type:
            events = [e for e in events if e.event_type == event_type.value]

        return events

    def clear_history(self):
        """Clear event history."""
        self._event_history.clear()
