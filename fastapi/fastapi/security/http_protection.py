"""HTTP Basic authentication with brute force protection."""

import hashlib
import time
from collections import defaultdict
from typing import Dict, Optional, Tuple

from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials


class HTTPBasicWithProtection(HTTPBasic):
    """HTTP Basic authentication with brute force protection.

    Tracks failed login attempts per IP and blocks requests after
    max_attempts failures within the configured window.

    Args:
        max_attempts: Maximum failed attempts before blocking (default: 5).
        window_seconds: Time window in seconds for tracking attempts (default: 300).
        scheme_name: Name of the authentication scheme.
        realm: HTTP Basic realm.
        auto_error: Whether to raise on missing credentials.
    """

    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 300,
        scheme_name: Optional[str] = None,
        realm: Optional[str] = None,
        auto_error: bool = True,
    ):
        super().__init__(scheme_name=scheme_name, realm=realm, auto_error=auto_error)
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._failed_attempts: Dict[str, list] = defaultdict(list)

    def _get_client_key(self, request: Request) -> str:
        """Get a unique key for the client (IP + forwarded-for if present)."""
        forwarded = request.headers.get("x-forwarded-for", "")
        client_ip = request.client.host if request.client else "unknown"
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        return hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    def _is_blocked(self, client_key: str) -> Tuple[bool, Optional[int]]:
        """Check if client is blocked and return retry-after seconds."""
        now = time.time()
        attempts = self._failed_attempts[client_key]
        # Clean old attempts outside the window
        self._failed_attempts[client_key] = [
            t for t in attempts if now - t < self.window_seconds
        ]
        attempts = self._failed_attempts[client_key]

        if len(attempts) >= self.max_attempts:
            oldest_in_window = min(attempts)
            retry_after = int(self.window_seconds - (now - oldest_in_window))
            return True, max(retry_after, 1)
        return False, None

    def record_failure(self, request: Request) -> None:
        """Record a failed authentication attempt."""
        client_key = self._get_client_key(request)
        self._failed_attempts[client_key].append(time.time())

    def record_success(self, request: Request) -> None:
        """Clear failed attempts on successful login."""
        client_key = self._get_client_key(request)
        self._failed_attempts.pop(client_key, None)

    async def __call__(self, request: Request) -> HTTPBasicCredentials:
        """Authenticate request with brute force protection check."""
        client_key = self._get_client_key(request)

        blocked, retry_after = self._is_blocked(client_key)
        if blocked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

        credentials = await super().__call__(request)
        return credentials
