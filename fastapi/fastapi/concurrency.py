"""Concurrent task execution utilities for FastAPI."""

import asyncio
from typing import Any, Coroutine, List, Optional, TypeVar

T = TypeVar("T")


async def run_concurrently(
    coroutines: List[Coroutine[Any, Any, T]],
    max_concurrency: int = 10,
    timeout: Optional[float] = None,
) -> List[T]:
    """Run multiple coroutines concurrently with semaphore limiting and optional timeout.

    Args:
        coroutines: List of coroutines to execute.
        max_concurrency: Maximum number of concurrent tasks (default: 10).
        timeout: Optional timeout in seconds for each individual coroutine.

    Returns:
        List of results in the same order as the input coroutines.

    Raises:
        Exception: Re-raises the first exception encountered from any coroutine.
    """
    semaphore = asyncio.Semaphore(max_concurrency)
    results: List[Any] = [None] * len(coroutines)
    exceptions: List[Optional[Exception]] = [None] * len(coroutines)

    async def _run_with_semaphore(index: int, coro: Coroutine[Any, Any, T]) -> None:
        async with semaphore:
            try:
                if timeout is not None:
                    results[index] = await asyncio.wait_for(coro, timeout=timeout)
                else:
                    results[index] = await coro
            except Exception as e:
                exceptions[index] = e

    tasks = [
        asyncio.create_task(_run_with_semaphore(i, coro))
        for i, coro in enumerate(coroutines)
    ]

    await asyncio.gather(*tasks)

    # Re-raise first exception if any
    for exc in exceptions:
        if exc is not None:
            raise exc

    return results
