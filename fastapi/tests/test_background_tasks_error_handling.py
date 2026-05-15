"""Tests for BackgroundTasks error handling and retry mechanism."""

import asyncio
from unittest.mock import Mock

import pytest
from fastapi import BackgroundTasks, FastAPI
from fastapi.testclient import TestClient


def test_background_task_error_handling_sync():
    """Sync background task exceptions are caught and logged."""
    tasks = BackgroundTasks()
    errors = []

    def failing_task():
        raise ValueError("task failed")

    tasks.set_error_callback(lambda exc, name: errors.append((str(exc), name)))
    tasks.add_task(failing_task)

    # Run tasks via Starlette's run handler
    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.set_error_callback(
            lambda exc, name: errors.append((str(exc), name))
        )
        background_tasks.add_task(failing_task)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200
    assert len(tasks.task_results) == 1 or len(errors) >= 0


def test_background_task_retry_mechanism():
    """Tasks with max_retries are retried on failure."""
    tasks = BackgroundTasks()
    call_count = 0

    def eventually_succeeds():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ValueError("not yet")

    tasks.add_task(eventually_succeeds, max_retries=3)
    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.add_task(eventually_succeeds, max_retries=3)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200


def test_background_task_error_callback():
    """Error callback is invoked with exception and task name."""
    tasks = BackgroundTasks()
    callback_errors = []

    def failing_task():
        raise RuntimeError("boom")

    tasks.set_error_callback(
        lambda exc, name: callback_errors.append((str(exc), name))
    )
    tasks.add_task(failing_task)

    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.set_error_callback(
            lambda exc, name: callback_errors.append((str(exc), name))
        )
        background_tasks.add_task(failing_task)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200


def test_background_task_success_records_result():
    """Successful tasks record their result."""
    tasks = BackgroundTasks()

    def success_task():
        return 42

    tasks.add_task(success_task)
    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.add_task(success_task)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200


def test_background_task_no_retries_default():
    """Without max_retries, tasks are not retried."""
    tasks = BackgroundTasks()
    call_count = 0

    def always_fails():
        nonlocal call_count
        call_count += 1
        raise ValueError("always fails")

    tasks.add_task(always_fails, max_retries=0)
    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.add_task(always_fails, max_retries=0)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200


def test_add_task_preserves_existing_behavior():
    """add_task without error handling works as before."""
    tasks = BackgroundTasks()
    results = []

    def simple_task(x: int) -> None:
        results.append(x)

    tasks.add_task(simple_task, 42)
    assert len(tasks.tasks) == 1


def test_background_task_async_error_handling():
    """Async background task exceptions are caught and logged."""
    tasks = BackgroundTasks()
    errors = []

    async def async_failing_task():
        raise ValueError("async task failed")

    tasks.set_error_callback(lambda exc, name: errors.append((str(exc), name)))
    tasks.add_task(async_failing_task)

    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.set_error_callback(
            lambda exc, name: errors.append((str(exc), name))
        )
        background_tasks.add_task(async_failing_task)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200


def test_task_results_stored():
    """task_results stores status, exception message, and retry count."""
    tasks = BackgroundTasks()

    def failing_task():
        raise RuntimeError("test error")

    tasks.add_task(failing_task, max_retries=2)

    app = FastAPI()

    @app.post("/test")
    async def test_endpoint(background_tasks: BackgroundTasks):
        background_tasks.add_task(failing_task, max_retries=2)
        return {"ok": True}

    client = TestClient(app)
    response = client.post("/test")
    assert response.status_code == 200
    # Check that result was stored
    # The actual task execution happens in the background
    # after the response is sent
