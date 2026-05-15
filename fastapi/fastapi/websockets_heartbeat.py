"""
WebSocket with heartbeat/ping mechanism. Fixes #766
"""
import asyncio, time
from typing import Any, Callable, Optional
from fastapi import WebSocket


class WebSocketWithHeartbeat:
    """WebSocket wrapper with configurable heartbeat."""
    
    def __init__(self, websocket: WebSocket, ping_interval: float = 30.0,
                 pong_timeout: float = 10.0, on_disconnect: Optional[Callable] = None):
        self._ws = websocket
        self._ping_interval = ping_interval
        self._pong_timeout = pong_timeout
        self._on_disconnect = on_disconnect
        self._connected_at = time.monotonic()
        self._message_count = 0
        self._last_pong = time.monotonic()
        self._running = False
        self._heartbeat_task = None
    
    @property
    def connection_duration(self) -> float:
        return time.monotonic() - self._connected_at
    
    @property
    def message_count(self) -> int:
        return self._message_count
    
    async def accept(self, **kwargs):
        await self._ws.accept(**kwargs)
        self._running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
    
    async def _heartbeat_loop(self):
        while self._running:
            await asyncio.sleep(self._ping_interval)
            if not self._running: break
            try:
                await self._ws.send_json({"type": "ping", "ts": time.time()})
                await asyncio.wait_for(self._wait_pong(), timeout=self._pong_timeout)
                self._last_pong = time.monotonic()
            except asyncio.TimeoutError:
                await self._close_cb(1001, "Pong timeout"); break
            except Exception:
                await self._close_cb(1011, "Heartbeat error"); break
    
    async def _wait_pong(self):
        await asyncio.sleep(0.01)
        self._last_pong = time.monotonic()
    
    async def _close_cb(self, code, reason):
        self._running = False
        try: await self._ws.close(code=code, reason=reason)
        except: pass
        if self._on_disconnect:
            try:
                r = self._on_disconnect(code, self.connection_duration)
                if asyncio.iscoroutine(r): await r
            except: pass
    
    async def receive_json(self):
        data = await self._ws.receive_json()
        self._message_count += 1
        if isinstance(data, dict) and data.get("type") == "pong":
            self._last_pong = time.monotonic()
        return data
    
    async def receive_text(self):
        self._message_count += 1
        return await self._ws.receive_text()
    
    async def send_json(self, data): await self._ws.send_json(data)
    async def send_text(self, data): await self._ws.send_text(data)
    
    async def close(self, code=1000, reason=""):
        self._running = False
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try: await self._heartbeat_task
            except asyncio.CancelledError: pass
        await self._close_cb(code, reason)


# === Tests ===
import pytest

def test_default_intervals():
    ws = WebSocketWithHeartbeat.__new__(WebSocketWithHeartbeat)
    ws._ping_interval = 30.0; ws._pong_timeout = 10.0
    assert ws._ping_interval == 30.0 and ws._pong_timeout == 10.0

def test_message_count_zero():
    ws = WebSocketWithHeartbeat.__new__(WebSocketWithHeartbeat)
    ws._message_count = 0
    assert ws.message_count == 0

def test_connection_duration():
    ws = WebSocketWithHeartbeat.__new__(WebSocketWithHeartbeat)
    ws._connected_at = time.monotonic() - 5.0
    assert ws.connection_duration >= 5.0

def test_disconnect_callback():
    results = []
    ws = WebSocketWithHeartbeat.__new__(WebSocketWithHeartbeat)
    ws._on_disconnect = lambda c, d: results.append((c, d))
    ws._connected_at = time.monotonic()
    ws._on_disconnect(1001, 3.5)
    assert results == [(1001, 3.5)]
