from typing import Callable, Awaitable

from starlette.middleware.cors import CORSMiddleware as CORSMiddleware  # noqa
from starlette.requests import Request
from starlette.responses import Response, JSONResponse


class DynamicCORSMiddleware:
    """
    CORS middleware that supports dynamic origin validation via a callback function.

    Unlike the static CORSMiddleware which uses a fixed list of allowed origins,
    DynamicCORSMiddleware accepts a callback function (`allow_origin_func`) that
    is invoked for each request to determine whether the origin should be allowed.

    The callback can be either a sync or async function that receives the origin
    string and returns True/False.

    When `allow_origin_func` is not provided, it falls back to the static
    `allow_origins` list.

    ## Example

    ```python
    from fastapi import FastAPI
    from fastapi.middleware.cors import DynamicCORSMiddleware

    app = FastAPI()

    def is_allowed(origin: str) -> bool:
        return origin.endswith(".example.com")

    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origin_func=is_allowed,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```
    """

    def __init__(
        self,
        app: Callable,
        allow_origin_func: Callable[[str], bool] | Callable[[str], Awaitable[bool]] | None = None,
        allow_origins: list[str] | None = None,
        allow_methods: list[str] | None = None,
        allow_headers: list[str] | None = None,
        allow_credentials: bool = False,
        allow_origin_regex: str | None = None,
        expose_headers: list[str] | None = None,
        cors_max_age: int = 600,
    ) -> None:
        self.app = app
        self.allow_origin_func = allow_origin_func
        self.allow_origins = allow_origins or []
        self.allow_methods = allow_methods or ["*"]
        self.allow_headers = allow_headers or []
        self.allow_credentials = allow_credentials
        self.allow_origin_regex = allow_origin_regex
        self.expose_headers = expose_headers or []
        self.cors_max_age = cors_max_age

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)

        if request.method == "OPTIONS":
            # Preflight request
            origin = request.headers.get("origin", "")
            allowed = await self._is_origin_allowed(origin)

            if allowed:
                response = Response(status_code=204)
                self._set_cors_headers(response, origin)
                response.headers["Access-Control-Max-Age"] = str(self.cors_max_age)
                await response(scope, receive, send)
                return
            else:
                response = Response(status_code=403)
                await response(scope, receive, send)
                return

        # Regular request
        origin = request.headers.get("origin", "")
        allowed = await self._is_origin_allowed(origin)

        async def send_with_cors(message):
            if message["type"] == "http.response.start" and allowed and origin:
                headers = dict(message.get("headers", []))
                headers[b"access-control-allow-origin"] = origin.encode()
                if self.allow_credentials:
                    headers[b"access-control-allow-credentials"] = b"true"
                if self.expose_headers:
                    headers[b"access-control-expose-headers"] = ", ".join(
                        self.expose_headers
                    ).encode()
                message["headers"] = list(headers.items())
            await send(message)

        await self.app(scope, receive, send_with_cors)

    async def _is_origin_allowed(self, origin: str) -> bool:
        """Check if the origin is allowed using the callback or static list."""
        if not origin:
            return False

        if self.allow_origin_func is not None:
            result = self.allow_origin_func(origin)
            if hasattr(result, "__await__"):
                return await result
            return result

        return origin in self.allow_origins

    def _set_cors_headers(self, response: Response, origin: str) -> None:
        """Set CORS headers on the response."""
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
        response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
        if self.allow_credentials:
            response.headers["Access-Control-Allow-Credentials"] = "true"
        if self.expose_headers:
            response.headers["Access-Control-Expose-Headers"] = ", ".join(
                self.expose_headers
            )
