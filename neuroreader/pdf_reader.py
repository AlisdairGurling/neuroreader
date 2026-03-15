"""PDF text extraction for NeuroReader."""

import io
from pathlib import Path

try:
    import pymupdf as fitz  # PyMuPDF
except ImportError:
    try:
        import fitz  # Older PyMuPDF import
    except ImportError:
        fitz = None


class PDFError(Exception):
    """Raised when PDF processing fails."""
    pass


def extract_text_from_pdf(file_path: str | Path | None = None, file_bytes: bytes | None = None) -> str:
    """
    Extract readable text from a PDF file.

    Accepts either a file path or raw bytes (for uploads).
    Returns the full text content with page breaks marked.
    """
    if fitz is None:
        raise PDFError(
            "PyMuPDF is not installed. Run: pip install pymupdf"
        )

    try:
        if file_bytes:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        elif file_path:
            doc = fitz.open(str(file_path))
        else:
            raise PDFError("Provide either a file path or file bytes.")
    except Exception as e:
        raise PDFError(f"Could not open PDF: {e}")

    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        if text.strip():
            pages.append(text.strip())

    doc.close()

    if not pages:
        raise PDFError(
            "No readable text found in this PDF. "
            "It may be a scanned document — OCR support is planned for a future release."
        )

    return "\n\n---\n\n".join(pages)


def extract_text_by_pages(file_path: str | Path | None = None, file_bytes: bytes | None = None) -> list[str]:
    """Extract text from a PDF, returning a list of strings (one per page)."""
    if fitz is None:
        raise PDFError("PyMuPDF is not installed. Run: pip install pymupdf")

    try:
        if file_bytes:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        elif file_path:
            doc = fitz.open(str(file_path))
        else:
            raise PDFError("Provide either a file path or file bytes.")
    except Exception as e:
        raise PDFError(f"Could not open PDF: {e}")

    pages = []
    for page in doc:
        pages.append(page.get_text("text").strip())

    doc.close()
    return pages
