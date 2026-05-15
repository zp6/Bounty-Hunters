import asyncio
import logging
from collections.abc import Callable
from typing import Annotated, Any

from annotated_doc import Doc
from starlette.background import BackgroundTasks as StarletteBackgroundTasks
from typing_extensions import ParamSpec

from fastapi.logger import logger as fastapi_logger

P = ParamSpec("P")


class BackgroundTasks(StarletteBackgroundTasks):
    """
    A collection of background tasks that will be called after a response has been
    sent to the client.

    Read more about it in the
    [FastAPI docs for Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/).

    ## Example

    ```python
    from fastapi import BackgroundTasks, FastAPI

    app = FastAPI()


    def write_notification(email: str, message=""):
        with open("log.txt", mode="w") as email_file:
            content = f"notification for {email}: {message}"
            email_file.write(content)


    @app.post("/send-notification/{email}")
    async def send_notification(email: str, background_tasks: BackgroundTasks):
        background_tasks.add_task(write_notification, email, message="some notification")
        return {"message": "Notification sent in the background"}
    ```
    """

    def __init__(self) -> None:
        super().__init__()
        self.task_results: list[dict[str, Any]] = []
        self._error_callback: Callable[[Exception, str], Any] | None = None

    def set_error_callback(
        self,
        callback: Annotated[
            Callable[[Exception, str], Any],
            Doc(
                """
                A callback function that will be called when a background task raises
                an exception. It receives the exception object and the task function name.
                """
            ),
        ],
    ) -> None:
        """
        Set a callback function that will be invoked when a background task raises
        an exception.

        The callback receives the exception object and the original task function name.
        """
        self._error_callback = callback

    def add_task(
        self,
        func: Annotated[
            Callable[P, Any],
            Doc(
                """
                The function to call after the response is sent.

                It can be a regular `def` function or an `async def` function.
                """
            ),
        ],
        *args: P.args,
        max_retries: Annotated[
            int,
            Doc(
                """
                Maximum number of retries for the task if it fails.
                Defaults to 0 (no retries).
                """
            ),
        ] = 0,
        **kwargs: P.kwargs,
    ) -> None:
        """
        Add a function to be called in the background after the response is sent.

        Read more about it in the
        [FastAPI docs for Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/).
        """
        wrapped_func = self._wrap_task(func, max_retries)
        return super().add_task(wrapped_func, *args, **kwargs)

    def _wrap_task(
        self, func: Callable[P, Any], max_retries: int
    ) -> Callable[P, Any]:
        """Wrap a task function with error handling and retry logic."""
        task_name = getattr(func, "__name__", str(func))

        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None
            attempts = max_retries + 1

            for attempt in range(attempts):
                try:
                    result = await func(*args, **kwargs)  # type: ignore[misc]
                    self.task_results.append(
                        {
                            "status": "success",
                            "task_name": task_name,
                            "attempt": attempt + 1,
                        }
                    )
                    return result
                except Exception as exc:
                    last_exception = exc
                    fastapi_logger.error(
                        "Background task '%s' failed (attempt %d/%d): %s",
                        task_name,
                        attempt + 1,
                        attempts,
                        str(exc),
                    )
                    if attempt < max_retries:
                        continue
                    # Final failure
                    result_entry = {
                        "status": "failed",
                        "task_name": task_name,
                        "exception": str(last_exception),
                        "retries": max_retries,
                    }
                    self.task_results.append(result_entry)
                    if self._error_callback is not None:
                        try:
                            self._error_callback(last_exception, task_name)
                        except Exception as callback_exc:
                            fastapi_logger.error(
                                "Error callback for task '%s' raised: %s",
                                task_name,
                                str(callback_exc),
                            )

        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None
            attempts = max_retries + 1

            for attempt in range(attempts):
                try:
                    result = func(*args, **kwargs)
                    self.task_results.append(
                        {
                            "status": "success",
                            "task_name": task_name,
                            "attempt": attempt + 1,
                        }
                    )
                    return result
                except Exception as exc:
                    last_exception = exc
                    fastapi_logger.error(
                        "Background task '%s' failed (attempt %d/%d): %s",
                        task_name,
                        attempt + 1,
                        attempts,
                        str(exc),
                    )
                    if attempt < max_retries:
                        continue
                    # Final failure
                    result_entry = {
                        "status": "failed",
                        "task_name": task_name,
                        "exception": str(last_exception),
                        "retries": max_retries,
                    }
                    self.task_results.append(result_entry)
                    if self._error_callback is not None:
                        try:
                            self._error_callback(last_exception, task_name)
                        except Exception as callback_exc:
                            fastapi_logger.error(
                                "Error callback for task '%s' raised: %s",
                                task_name,
                                str(callback_exc),
                            )

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
