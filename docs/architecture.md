# Architecture

```text
Browser ──HTTPS──> Caddy ──internal Compose network──> FastAPI
                                                     ├── PostgreSQL 16 + pgvector
                                                     └── 9Router ──> configured AI providers
```

FastAPI serves static files and a same-origin API. Login compares an application password in constant time and stores only an authenticated flag in a signed, HttpOnly, SameSite=Strict session cookie. API routes require that session. The UI displays saved conversations and memories; deleting a conversation removes its messages while memories remain separately manageable.

Chat messages are committed to PostgreSQL after a successful model response. Each user message is also stored as a memory with its 9Router embedding. Retrieval embeds the current question, filters vector rows by matching dimension, and ranks them by cosine distance. If embeddings are unavailable, recent saved notes are used as a fallback. Saved notes are supplied as untrusted reference text in the system message.

The database image includes pgvector. The application uses SQLAlchemy async and creates initial tables on startup. Schema evolution beyond the initial schema needs an explicit migration before upgrading a deployment.

The host exposes the app only on `127.0.0.1:8000` and 9Router dashboard only on `127.0.0.1:20128`. Caddy is the public entry point for ports 80 and 443. PostgreSQL has no published host port. Backup dumps are encrypted with the `age` recipient before they are kept in `./backups`; the decryption identity stays outside the backup container.

## ARM64 support

The Python base image, PostgreSQL/pgvector image, Caddy image, and pinned official 9Router image publish ARM64 variants. The application has no x86-only binary extension. Build on the Ubuntu ARM64 host with Docker Compose, or use `docker buildx` with `--platform linux/arm64`.
