# Mobile Personal AI App Implementation Plan

> **For agentic workers:** Execute inline in small, reviewable steps. Preserve the current FastAPI API and chat behavior while matching the approved Nara mobile design.

**Goal:** Turn the Nara mobile concept into an installable, responsive application with working home, chat, voice, memory, and reminder flows.

**Architecture:** Keep FastAPI, PostgreSQL, pgvector, and 9Router. Extend the existing static frontend into a semantic mobile-first PWA; use browser speech recognition and synthesis for voice, and authenticated FastAPI endpoints for chat, memory, history, and reminders.

**Tech Stack:** FastAPI, SQLAlchemy async, PostgreSQL/pgvector, vanilla JavaScript, HTML, CSS, Web Speech API, Docker Compose.

---

## File map

- `app/static/index.html`: semantic app shell, login, mobile navigation, and view containers.
- `app/static/app.css`: Nara design tokens, responsive layouts, focus states, reduced motion, and voice states.
- `app/static/app.js`: app state, screen navigation, chat/history, memory, voice, reminder, and install flows.
- `app/models.py`: persistent reminder model alongside conversations, messages, and memories.
- `app/main.py`: searchable conversation listing, explicit memory saving, reminder CRUD/completion, and account data export.
- `app/static/manifest.webmanifest`, `app/static/sw.js`, `app/static/icon.svg`: install metadata, static-shell cache, and app icon.
- `README.md`: app capabilities, browser voice support and PWA installation notes.
- `docs/plans/2026-11-10-mobile-app.md`: scope, implementation record, and manual verification notes.
- `.agent/progress.md`, `.agent/decisions.md`: durable session status and implementation decisions.

## Task 1: Mobile app shell and visual system

Rework the existing page into Home, Chat, Voice, Memories, Reminders, and Settings views with the design's cobalt companion, light surfaces, Indonesian labels, bottom navigation, and accessible state announcements. Keep the password login, conversation list, memory deletion, delete dialog, chat composer, and logout behavior.

## Task 2: Persistent history, memory, and reminders

Add title/message search to conversation listing, authenticated explicit-memory saving, a PostgreSQL reminder record and authenticated endpoints to list, create, complete, and delete reminders. Add a JSON export endpoint for a user's conversations, messages, memories, and reminders. Existing database rows and API shapes stay compatible.

## Task 3: Voice and installable app behavior

Add Indonesian speech-to-text when the browser exposes `SpeechRecognition`/`webkitSpeechRecognition`, transcript editing, send through the existing `/api/chat`, and explicit text-to-speech playback. Show permission/browser fallback states. Add a PWA manifest and cache only the static application shell; never cache authenticated API responses.

## Task 4: Documentation and verification

Document voice-provider privacy limits, install instructions, reminder behavior, and remaining deployment prerequisites. Verify source files parse, ZIP/Compose files remain intact, endpoints match UI calls, and use a browser view to inspect mobile/desktop layout if a local runtime is available. Do not claim live voice or OCI behavior beyond what can be observed locally.

## Implementation record

- [x] Inspected the existing FastAPI and static web-chat foundation; confirmed login, persistent chat, memory, deletion, and mobile-responsive styling already exist.
- [x] Reused the established Nara visual direction from `design/nara-personal-ai-mobile.svg`.
- [x] Build the mobile screen shell and interactions.
- [x] Add searchable history, reminders, and data export endpoints.
- [x] Add browser voice and installable PWA behavior.
- [x] Update deployment documentation and verify syntax and source wiring.

## Scope notes

- Voice is browser-managed speech recognition/synthesis, not a realtime server-side audio agent. Browser support and microphone permission vary.
- Recurring reminders advance when marked done. Browser notifications are checked while the app is open; server push and closed-app scheduling are not part of this implementation.
- On a database that already contains the previous app tables, startup creates the new `reminders` table. No existing chat or memory table is changed.
- Syntax checks passed for Python and JavaScript, and all JavaScript ID selectors resolve in the HTML. Automated tests and a live database/provider session were not run in this environment.
