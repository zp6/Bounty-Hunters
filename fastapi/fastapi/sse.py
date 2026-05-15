"""
Enhanced SSE (Server-Sent Events) with disconnect detection,
event filtering, and reconnect replay.

Patch for fastapi/fastapi/sse.py
"""

import asyncio
import json
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional, Set

from starlette.requests import Request
from starlette.responses import StreamingResponse


class SSEEvent:
    """Represents a single Server-Sent Event."""

    def __init__(
        self,
        data: Any,
        event: Optional[str] = None,
        event_id: Optional[str] = None,
        retry: Optional[int] = None,
    ):
        self.data = data
        self.event = event
        self.event_id = event_id
        self.retry = retry

    def encode(self) -> str:
        """Encode the event as SSE text format."""
        lines = []
        if self.event_id:
            lines.append(f"id: {self.event_id}")
        if self.event:
            lines.append(f"event: {self.event}")
        if self.retry:
            lines.append(f"retry: {self.retry}")
        if isinstance(self.data, str):
            for line in self.data.split("\n"):
                lines.append(f"data: {line}")
        else:
            lines.append(f"data: {json.dumps(self.data)}")
        lines.append("")
        lines.append("")
        return "\n".join(lines)


class SSEManager:
    """Manages SSE connections with event history for reconnect replay."""

    def __init__(self, max_history: int = 1000):
        self._history: List[SSEEvent] = []
        self._max_history = max_history
        self._event_counter = 0

    def record_event(self, event: SSEEvent) -> None:
        """Record an event in history for replay."""
        self._event_counter += 1
        if not event.event_id:
            event.event_id = str(self._event_counter)
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

    def get_events_since(self, last_event_id: str) -> List[SSEEvent]:
        """Get events after the given event ID for replay."""
        for i, event in enumerate(self._history):
            if event.event_id == last_event_id:
                return self._history[i + 1:]
        return []


async def sse_stream(
    request: Request,
    event_generator: AsyncGenerator[SSEEvent, None],
    event_type: Optional[str] = None,
    sse_manager: Optional[SSEManager] = None,
) -> StreamingResponse:
    """Create an SSE streaming response with disconnect detection.

    Args:
        request: The incoming request (used for disconnect detection).
        event_generator: Async generator yielding SSEEvent objects.
        event_type: Optional filter to only send events of this type.
        sse_manager: Optional SSEManager for event history and replay.

    Returns:
        StreamingResponse with SSE content type.
    """
    async def _stream() -> AsyncGenerator[str, None]:
        disconnected = False

        async for event in event_generator:
            # Check for client disconnect
            if await request.is_disconnected():
                disconnected = True
                break

            # Filter by event type if specified
            if event_type and event.event != event_type:
                continue

            # Record event for replay
            if sse_manager:
                sse_manager.record_event(event)

            yield event.encode()

        if not disconnected:
            yield ": disconnected\n\n"

    # Handle Last-Event-Id for reconnect replay
    last_event_id = request.headers.get("last-event_id") or request.headers.get("last-event-id")

    async def _stream_with_replay() -> AsyncGenerator[str, None]:
        # Replay missed events if manager and last_event_id provided
        if sse_manager and last_event_id:
            missed = sse_manager.get_events_since(last_event_id)
            for event in missed:
                if event_type and event.event != event_type:
                    continue
                yield event.encode()

        async for chunk in _stream():
            yield chunk

    return StreamingResponse(
        _stream_with_replay(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
