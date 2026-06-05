"""Backend entrypoint.

Run with one of:
    python -m app.main
    gc-backend            (installed console script)
    uvicorn app.app:app   (direct ASGI)
"""

from __future__ import annotations

from .app import app, create_app
from .config import settings

__all__ = ["app", "create_app", "run"]


def run() -> None:
    """Start the uvicorn server using configured host/port."""
    import uvicorn

    uvicorn.run(
        "app.app:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    run()
