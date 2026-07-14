"""
Tests for the ```chu-action fence parser (app/services/streaming.py).

This is the trickiest hand-rolled logic in the backend — a real streaming API
can split the fence markers across chunk boundaries anywhere, including one
character at a time — so it's tested against that directly rather than only
against conveniently-chunked examples.
"""
from __future__ import annotations

import random

from app.services.streaming import ActionRawEvent, StreamActionExtractor, TokenEvent


def run(chunks: list[str]):
    extractor = StreamActionExtractor()
    events = []
    for chunk in chunks:
        events.extend(extractor.feed(chunk))
    events.extend(extractor.finalize())
    return events


def visible_text(events) -> str:
    return "".join(e.text for e in events if isinstance(e, TokenEvent))


def action_payloads(events) -> list[str]:
    return [e.raw for e in events if isinstance(e, ActionRawEvent)]


def test_plain_text_passthrough():
    events = run(["Hello ", "there, ", "how are you?"])
    assert visible_text(events) == "Hello there, how are you?"
    assert action_payloads(events) == []


def test_single_chunk_action_block():
    events = run(['Sure!\n```chu-action\n{"action": "open_app", "params": {"name": "notepad"}}\n```\nDone.'])
    assert visible_text(events) == "Sure!\n\nDone."
    assert action_payloads(events) == ['{"action": "open_app", "params": {"name": "notepad"}}']


def test_char_by_char_worst_case():
    full = 'Before. ```chu-action\n{"action": "search_web", "params": {"query": "weather"}}\n```\nAfter.'
    events = run(list(full))
    assert visible_text(events) == "Before. \nAfter."
    assert action_payloads(events) == ['{"action": "search_web", "params": {"query": "weather"}}']


def test_ordinary_code_fence_not_treated_as_action():
    events = run(["Here:\n```python\nprint('hi')\n```\nOK"])
    assert visible_text(events) == "Here:\n```python\nprint('hi')\n```\nOK"
    assert action_payloads(events) == []


def test_unterminated_action_block_is_dropped_not_leaked():
    events = run(["Text before ", '```chu-action\n{"action": "open_app"'])
    assert visible_text(events) == "Text before "
    assert action_payloads(events) == []


def test_two_sequential_action_blocks():
    events = run(['A\n```chu-action\n{"a":1}\n```\nB\n```chu-action\n{"a":2}\n```\nC'])
    assert visible_text(events) == "A\n\nB\n\nC"
    assert action_payloads(events) == ['{"a":1}', '{"a":2}']


def test_closing_fence_split_into_single_backtick_chunks():
    """Regression test: the closing ``` must be recognized even when a provider
    happens to emit it as three separate single-character tokens."""
    events = run(["```chu-action", '{"a":1}', "`", "`", "`", "tail"])
    assert action_payloads(events) == ['{"a":1}']
    assert visible_text(events) == "tail"


def test_chunk_boundaries_never_change_the_result_fuzz():
    reference = (
        'Hey!\n```chu-action\n{"action": "set_reminder", '
        '"params": {"title": "call mom", "due_at": "2026-07-10T10:00:00"}}\n```\nAll set.'
    )
    expected_events = run([reference])
    expected_visible = visible_text(expected_events)
    expected_actions = action_payloads(expected_events)

    rng = random.Random(42)
    for _ in range(200):
        n_cuts = rng.randint(1, min(20, len(reference) - 1))
        cuts = sorted(rng.sample(range(1, len(reference)), k=n_cuts))
        chunks, prev = [], 0
        for c in cuts:
            chunks.append(reference[prev:c])
            prev = c
        chunks.append(reference[prev:])

        events = run(chunks)
        assert visible_text(events) == expected_visible
        assert action_payloads(events) == expected_actions


def test_unicode_and_nested_backticks_in_payload():
    reference = (
        "Sure — I'll check \U0001F642\n```chu-action\n"
        '{"action": "copy_to_clipboard", "params": {"text": "```nested``` backticks``"}}\n'
        "```\nCopied that for you."
    )
    whole = run([reference])
    char_by_char = run(list(reference))
    assert visible_text(whole) == visible_text(char_by_char)
    assert action_payloads(whole) == action_payloads(char_by_char)
