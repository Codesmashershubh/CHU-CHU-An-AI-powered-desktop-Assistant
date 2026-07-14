"""
Incremental parser that watches a token stream go by and pulls out
```chu-action ... ``` blocks without ever letting their raw JSON leak into
the visible chat text — even when a provider splits the fence marker itself
across two separate network chunks (which happens constantly with real
streaming APIs).

The approach: hold back any buffered tail that could still turn into the
start of a fence marker once more text arrives, and only flush text once
it's unambiguously *not* part of one. This is the same "don't emit until
disambiguated" idea a hand-rolled tokenizer uses for multi-char delimiters.
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal

FENCE_START = "```chu-action"
FENCE_END = "```"


@dataclass
class TokenEvent:
    text: str
    type: Literal["token"] = "token"


@dataclass
class ActionRawEvent:
    raw: str
    type: Literal["action_raw"] = "action_raw"


StreamEvent = TokenEvent | ActionRawEvent


def _longest_ambiguous_suffix_length(buf: str, marker: str) -> int:
    """Length of the longest suffix of `buf` that is also a prefix of `marker` —
    i.e. text we can't yet be sure isn't the start of `marker`."""
    max_check = min(len(marker) - 1, len(buf))
    for size in range(max_check, 0, -1):
        if marker.startswith(buf[-size:]):
            return size
    return 0


class StreamActionExtractor:
    def __init__(self) -> None:
        self._buffer = ""
        self._in_action_block = False
        self._action_buffer = ""

    def feed(self, chunk: str) -> list[StreamEvent]:
        events: list[StreamEvent] = []
        self._buffer += chunk

        while True:
            if not self._in_action_block:
                idx = self._buffer.find(FENCE_START)
                if idx == -1:
                    hold = _longest_ambiguous_suffix_length(self._buffer, FENCE_START)
                    safe_len = len(self._buffer) - hold
                    if safe_len > 0:
                        events.append(TokenEvent(text=self._buffer[:safe_len]))
                        self._buffer = self._buffer[safe_len:]
                    break
                else:
                    if idx > 0:
                        events.append(TokenEvent(text=self._buffer[:idx]))
                    self._buffer = self._buffer[idx + len(FENCE_START):]
                    self._in_action_block = True
                    self._action_buffer = ""
            else:
                idx = self._buffer.find(FENCE_END)
                if idx == -1:
                    # Same ambiguous-suffix holdback as the FENCE_START case above:
                    # don't commit a trailing partial "``" into the action buffer
                    # until we know whether it's about to become the closing fence.
                    hold = _longest_ambiguous_suffix_length(self._buffer, FENCE_END)
                    safe_len = len(self._buffer) - hold
                    if safe_len > 0:
                        self._action_buffer += self._buffer[:safe_len]
                        self._buffer = self._buffer[safe_len:]
                    break
                else:
                    self._action_buffer += self._buffer[:idx]
                    self._buffer = self._buffer[idx + len(FENCE_END):]
                    self._in_action_block = False
                    events.append(ActionRawEvent(raw=self._action_buffer.strip()))
                    self._action_buffer = ""

        return events

    def finalize(self) -> list[StreamEvent]:
        """Call once the underlying stream ends. Flushes any trailing safe text;
        silently discards an unterminated action block (better to drop a malformed
        automation request than leak raw JSON into the chat transcript)."""
        events: list[StreamEvent] = []
        if not self._in_action_block and self._buffer:
            events.append(TokenEvent(text=self._buffer))
        self._buffer = ""
        return events


async def extract_action_events(token_stream: AsyncIterator[str]) -> AsyncIterator[StreamEvent]:
    extractor = StreamActionExtractor()
    async for chunk in token_stream:
        for event in extractor.feed(chunk):
            yield event
    for event in extractor.finalize():
        yield event


def try_parse_action_json(raw: str) -> dict | None:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None
