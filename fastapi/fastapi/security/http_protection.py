"""
Brute force protection for HTTP Basic auth. Fixes #800
"""
import hmac, time
from collections import defaultdict
from typing import Tuple
from fastapi import HTTPException, Request, status
from fastapi.security.http import HTTPBasic, HTTPBasicCredentials


class HTTPBasicWithProtection(HTTPBasic):
    def __init__(self, max_attempts=5, window_seconds=300, lockout_seconds=900, **kw):
        super().__init__(**kw)
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        self._attempts = defaultdict(lambda: {"count": 0, "last": 0.0, "locked_until": 0.0})

    def _ip(self, request: Request) -> str:
        fwd = request.headers.get("X-Forwarded-For")
        if fwd: return fwd.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_locked(self, ip) -> Tuple[bool, int]:
        e = self._attempts[ip]
        if e["locked_until"] > time.monotonic():
            return True, max(int(e["locked_until"] - time.monotonic()), 1)
        return False, 0

    def _fail(self, ip):
        e = self._attempts[ip]; now = time.monotonic()
        if now - e["last"] > self.window_seconds: e["count"] = 0
        e["count"] += 1; e["last"] = now
        if e["count"] >= self.max_attempts:
            e["locked_until"] = now + self.lockout_seconds; e["count"] = 0

    def _pass(self, ip):
        self._attempts[ip]["count"] = 0

    @staticmethod
    def verify_password(provided: str, expected: str) -> bool:
        return hmac.compare_digest(provided.encode(), expected.encode())

    async def __call__(self, request: Request) -> HTTPBasicCredentials:
        ip = self._ip(request)
        locked, retry = self._is_locked(ip)
        if locked:
            raise HTTPException(429, f"Too many attempts. Retry in {retry}s.", headers={"Retry-After": str(retry)})
        try:
            cred = await super().__call__(request)
            self._pass(ip); return cred
        except HTTPException:
            self._fail(ip); raise


# === Tests ===
import pytest

def test_verify_correct():
    assert HTTPBasicWithProtection.verify_password("s", "s") is True

def test_verify_wrong():
    assert HTTPBasicWithProtection.verify_password("a", "b") is False

def test_lockout():
    auth = HTTPBasicWithProtection(max_attempts=2, lockout_seconds=60)
    auth._attempts["1.2.3.4"]["locked_until"] = time.monotonic() + 60
    ok, retry = auth._is_locked("1.2.3.4")
    assert ok and retry > 0

def test_success_resets():
    auth = HTTPBasicWithProtection()
    auth._attempts["x"]["count"] = 3
    auth._pass("x")
    assert auth._attempts["x"]["count"] == 0

def test_window_reset():
    auth = HTTPBasicWithProtection(window_seconds=300)
    e = auth._attempts["y"]
    e["count"] = 4; e["last"] = time.monotonic() - 301
    auth._fail("y")
    assert e["count"] == 1
