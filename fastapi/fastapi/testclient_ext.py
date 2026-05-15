"""FastAPITestClient with auth helpers and WebSocket convenience methods."""

import base64
import json
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Union

from fastapi.testclient import TestClient


class FastAPITestClient(TestClient):
    """Extended TestClient with authentication helpers and WebSocket utilities.

    Provides convenient methods for testing authenticated endpoints
    and WebSocket connections with custom headers.

    Usage:
        client = FastAPITestClient(app)
        client.authenticate(token="my-jwt-token")
        response = client.get("/protected")
    """

    _default_headers: Dict[str, str]

    def __init__(self, app: Any, **kwargs: Any) -> None:
        super().__init__(app, **kwargs)
        self._default_headers: Dict[str, str] = {}

    def authenticate(self, token: str, scheme: str = "Bearer") -> None:
        """Set Bearer token authentication for all subsequent requests.

        Args:
            token: The authentication token string.
            scheme: Auth scheme (default: "Bearer").
        """
        self._default_headers["Authorization"] = f"{scheme} {token}"

    def authenticate_basic(self, username: str, password: str) -> None:
        """Set HTTP Basic authentication for all subsequent requests.

        Args:
            username: Basic auth username.
            password: Basic auth password.
        """
        credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
        self._default_headers["Authorization"] = f"Basic {credentials}"

    def authenticate_api_key(self, api_key: str, header_name: str = "X-API-Key") -> None:
        """Set API key authentication header.

        Args:
            api_key: The API key string.
            header_name: Header name for the API key (default: "X-API-Key").
        """
        self._default_headers[header_name] = api_key

    def clear_authentication(self) -> None:
        """Remove all authentication headers."""
        self._default_headers.clear()

    def set_header(self, name: str, value: str) -> None:
        """Set a default header for all subsequent requests.

        Args:
            name: Header name.
            value: Header value.
        """
        self._default_headers[name] = value

    def remove_header(self, name: str) -> None:
        """Remove a default header.

        Args:
            name: Header name to remove.
        """
        self._default_headers.pop(name, None)

    def _merge_headers(self, kwargs: Dict[str, Any]) -> Dict[str, str]:
        """Merge default headers with request-specific headers."""
        headers = dict(self._default_headers)
        if "headers" in kwargs:
            headers.update(kwargs["headers"])
        return headers

    def get(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().get(url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().post(url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().put(url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().patch(url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().delete(url, **kwargs)

    def options(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().options(url, **kwargs)

    def head(self, url: str, **kwargs: Any) -> Any:
        kwargs["headers"] = self._merge_headers(kwargs)
        return super().head(url, **kwargs)

    @asynccontextmanager
    def websocket_connect(
        self,
        url: str,
        *,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Dict[str, str]] = None,
        auth_token: Optional[str] = None,
        **kwargs: Any,
    ):
        """Connect to a WebSocket with optional authentication.

        Args:
            url: WebSocket URL path.
            headers: Additional headers.
            params: Query parameters.
            auth_token: Optional Bearer token for WebSocket auth.

        Yields:
            WebSocket connection with send_json and receive_json helpers.
        """
        ws_headers = dict(self._default_headers)
        if headers:
            ws_headers.update(headers)
        if auth_token:
            ws_headers["Authorization"] = f"Bearer {auth_token}"

        # Build URL with params
        if params:
            query = "&".join(f"{k}={v}" for k, v in params.items())
            url = f"{url}?{query}" if "?" not in url else f"{url}&{query}"

        with super().websocket_connect(url, headers=ws_headers, **kwargs) as ws:
            # Add convenience methods
            ws.send_json = lambda data: ws.send_text(json.dumps(data))
            ws.receive_json = lambda: json.loads(ws.receive_text())
            yield ws
