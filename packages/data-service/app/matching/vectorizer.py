"""Pure-Python TF-IDF vectors and cosine similarity.

The data service intentionally ships a small runtime, so the classic
bag-of-words pipeline — tokenize, per-document term frequency, idf smoothing,
cosine — is implemented in the standard library only. Results are sparse
{term: weight} dicts, which keeps memory bounded for one-shot matching.
"""

from __future__ import annotations

import math
import re
from collections import Counter

from ..market.normalizer import clean_text

_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#./_\-]*")
_MIN_TOKEN_LEN = 2


def tokenize(text: str | None) -> list[str]:
    """Lowercases and splits text into bare tokens (>= 2 chars)."""
    found = _TOKEN_RE.findall(clean_text(text))
    return [token for token in found if len(token) >= _MIN_TOKEN_LEN]


def build_vocab(documents: list[list[str]]) -> dict[str, float]:
    """Returns {term: idf} smoothed over a corpus of tokenized documents.

    Uses the scikit-learn formulation: idf = ln((1 + N) / (1 + df)) + 1, so a
    term present in every document still carries a small positive weight and no
    term ever gets a negative one.
    """
    num_docs = len(documents)
    document_frequency: Counter = Counter()
    for tokens in documents:
        document_frequency.update(set(tokens))
    return {
        term: math.log((1 + num_docs) / (1 + frequency)) + 1.0
        for term, frequency in document_frequency.items()
    }


def tfidf(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    """Returns a sparse {term: weight} vector for one tokenized document."""
    counts = Counter(tokens)
    denominator = len(tokens) or 1
    return {
        term: (frequency / denominator) * idf[term]
        for term, frequency in counts.items()
        if term in idf
    }


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    """Cosine similarity between two sparse vectors, clamped to [0, 1]."""
    if not a or not b:
        return 0.0
    smaller, larger = (a, b) if len(a) <= len(b) else (b, a)
    dot = sum(value * larger[term] for term, value in smaller.items() if term in larger)
    norm_a = math.sqrt(sum(value * value for value in a.values()))
    norm_b = math.sqrt(sum(value * value for value in b.values()))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return min(1.0, dot / (norm_a * norm_b))
