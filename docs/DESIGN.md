# Chu Chu — Design

## Direction

The PRD pins down the structure explicitly: "Modern dark UI, sidebar, chat
panel, command palette." That's also the exact shape of Raycast, Linear,
Arc's command bar, and every other dark-mode dev tool released in the last
few years — so the structure isn't where this app gets to be distinctive.
The execution is.

Two clichés this deliberately avoids:
- The purple-gradient-on-black "AI startup" look.
- The near-black-plus-single-neon-accent look (also extremely common in AI
  tools specifically).

Instead: **a precision instrument panel.** Think the control surface of a
well-made piece of hardware — an audio interface, a synthesizer, a cockpit
readout — rather than a chat bubble app. Warm, not cold; specific, not
generic-dark-mode-#18.

## The mark

Chu Chu's logo is a **twin-pulse** — two beats on a baseline, like an EKG
blip repeated twice. It's a direct reference to the rhythm of the name
itself ("Chu-Chu," two syllables, one repeated beat) rather than a literal
illustration of anything cute — deliberately, since a name that sounds
playful doesn't mean the software should look like a toy. The same mark
doubles as the "Chu Chu is thinking" animation in the chat panel and the
voice-recording indicator, so it's functional, not just decorative.

## Color

| Token | Value | Role |
|---|---|---|
| `--chu-ink` | `#0D1013` | Base background — graphite, not pure black |
| `--chu-surface` / `--chu-surface-raised` | `#161A1F` / `#1F252C` | Panels, cards, hover states |
| `--chu-brass` | `#D5A253` | Primary accent — identity, primary actions, the mark |
| `--chu-signal` | `#5EC9C0` | Secondary accent — live/active state, connection status |
| `--chu-paper` | `#EDEAE3` | Primary text — warm off-white, not stark `#FFF` |
| `--chu-danger` | `#E0715A` | Errors, destructive actions |

Two restrained, warm-leaning accents rather than one bright one: brass reads
as "Chu Chu" (buttons, the logo, anything the assistant itself is doing),
signal-teal reads as "system status" (online/live indicators, voice
recording). Both accents are deliberately muted rather than neon-saturated —
the "instrument panel at night" feeling depends on restraint.

## Type

- **Display — Space Grotesk.** The wordmark and section headers. Geometric
  with real character (the distinctive `g`, tight apertures) without
  tipping into novelty.
- **Body — IBM Plex Sans.** Chat text, labels, buttons. IBM designed the
  Plex family specifically for technical/enterprise interfaces, which is
  exactly the register this app wants for its everyday reading text.
- **Mono — IBM Plex Mono.** Keyboard shortcuts, timestamps, the command
  palette input, provider tags. Earns its place functionally, not just
  aesthetically — a command-palette-driven tool has a lot of genuinely
  monospace-shaped content (shortcuts, exact values).

Fonts load from Google Fonts as a progressive enhancement (`tokens.css`);
every family has a solid system-font fallback, so a slow or blocked font
request never breaks the UI, just makes it slightly less on-brand for a
moment.

## Layout details worth naming
- **Restrained radii** (6–14px) — enough to feel considered, not so much
  that it reads as a soft consumer SaaS pill-button aesthetic.
- **Hairline borders over drop shadows** for elevation — panels separate
  via a 1px border in a slightly lighter graphite, with shadow reserved for
  genuinely floating elements (the command palette).
- **Transcript-style chat, not bubbles.** User messages get a subtle
  right-aligned card; Chu Chu's replies are full-width with just a small
  role marker, which reads better for the long, substantive replies an
  assistant actually gives (bubble-width text wrapping degrades badly past
  a few sentences).
- **Motion** is fast (120–200ms) and only ever supports a state change
  already happening — nothing animates for its own sake, and everything
  respects `prefers-reduced-motion`.
