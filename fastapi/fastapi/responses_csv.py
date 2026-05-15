"""Streaming CSV response for large dataset exports."""

import csv
import io
import asyncio
from typing import Any, AsyncGenerator, List, Optional, Sequence

from starlette.responses import StreamingResponse


class StreamingCSVResponse(StreamingResponse):
    """Streaming CSV response for large dataset exports.

    Accepts an async generator of row data and streams CSV output
    without loading the entire dataset into memory.

    Args:
        content: Async generator yielding rows (lists or dicts).
        filename: Download filename (default: "export.csv").
        headers: Column names for the header row. Required for dict rows,
            optional for list rows (will use indices if not provided).
        charset: Character encoding (default: "utf-8").
        delimiter: CSV field delimiter (default: ",").
        quotechar: CSV quote character (default: '"').
    """

    def __init__(
        self,
        content: AsyncGenerator,
        filename: str = "export.csv",
        headers: Optional[Sequence[str]] = None,
        charset: str = "utf-8",
        delimiter: str = ",",
        quotechar: str = '"',
        **kwargs: Any,
    ):
        self._headers_row = headers
        self._delimiter = delimiter
        self._quotechar = quotechar

        super().__init__(
            content=self._generate_csv(content),
            media_type=f"text/csv; charset={charset}",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": f"text/csv; charset={charset}",
            },
            **kwargs,
        )

    async def _generate_csv(self, rows: AsyncGenerator) -> AsyncGenerator[str, None]:
        """Generate CSV lines from async row generator."""
        output = io.StringIO()
        writer = csv.writer(
            output, delimiter=self._delimiter, quotechar=self._quotechar,
            quoting=csv.QUOTE_MINIMAL
        )

        first_row = True
        async for row in rows:
            if first_row:
                # Write header row
                if self._headers_row:
                    writer.writerow(self._headers_row)
                    yield output.getvalue()
                    output.seek(0)
                    output.truncate(0)
                first_row = False

            # Handle dict rows
            if isinstance(row, dict):
                if self._headers_row:
                    row_values = [row.get(h, "") for h in self._headers_row]
                else:
                    row_values = list(row.values())
            else:
                row_values = list(row)

            writer.writerow(row_values)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)
