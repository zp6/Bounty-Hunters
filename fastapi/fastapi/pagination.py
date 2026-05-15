"""Standardized pagination utilities for FastAPI."""

from typing import Any, Dict, Generic, List, Optional, TypeVar, Callable, Awaitable
from dataclasses import dataclass, field
from fastapi import Query

T = TypeVar("T")


@dataclass
class PaginatedResponse(Generic[T]):
    """Standardized paginated response model."""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool
    next_cursor: Optional[str] = None
    previous_cursor: Optional[str] = None


class Paginator:
    """Pagination utility supporting offset-based and cursor-based pagination.

    Usage:
        paginator = Paginator(page=1, page_size=20)
        response = await paginator.paginate(query_func, total_func)
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
        cursor: Optional[str] = Query(None, description="Cursor for cursor-based pagination"),
    ):
        self.page = page
        self.page_size = page_size
        self.cursor = cursor

    def get_offset(self) -> int:
        """Calculate offset from page and page_size."""
        return (self.page - 1) * self.page_size

    def get_total_pages(self, total: int) -> int:
        """Calculate total number of pages."""
        return (total + self.page_size - 1) // self.page_size if total > 0 else 0

    async def paginate(
        self,
        items_func: Callable[[int, int], Awaitable[List[T]]],
        total_func: Callable[[], Awaitable[int]],
    ) -> PaginatedResponse[T]:
        """Create a paginated response using offset-based pagination.

        Args:
            items_func: Async function that accepts (offset, limit) and returns items.
            total_func: Async function that returns total count.

        Returns:
            PaginatedResponse with items and metadata.
        """
        total = await total_func()
        offset = self.get_offset()
        items = await items_func(offset, self.page_size)
        total_pages = self.get_total_pages(total)

        return PaginatedResponse(
            items=items,
            total=total,
            page=self.page,
            page_size=self.page_size,
            total_pages=total_pages,
            has_next=self.page < total_pages,
            has_previous=self.page > 1,
        )

    async def paginate_cursor(
        self,
        items_func: Callable[[Optional[str], int], Awaitable[List[T]]],
        total_func: Callable[[], Awaitable[int]],
        cursor_encoder: Optional[Callable[[Any], str]] = None,
    ) -> PaginatedResponse[T]:
        """Create a paginated response using cursor-based pagination.

        Args:
            items_func: Async function that accepts (cursor, limit) and returns items.
            total_func: Async function that returns total count.
            cursor_encoder: Optional function to encode the next cursor from last item.

        Returns:
            PaginatedResponse with items and cursor metadata.
        """
        total = await total_func()
        items = await items_func(self.cursor, self.page_size)
        total_pages = self.get_total_pages(total)

        next_cursor = None
        if cursor_encoder and len(items) == self.page_size:
            next_cursor = cursor_encoder(items[-1])

        return PaginatedResponse(
            items=items,
            total=total,
            page=self.page,
            page_size=self.page_size,
            total_pages=total_pages,
            has_next=len(items) == self.page_size,
            has_previous=self.cursor is not None,
            next_cursor=next_cursor,
        )
