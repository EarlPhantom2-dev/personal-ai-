# Personal AI Agent Implementation Plan

> **Execution:** The plan is tracked inline in this repository and implemented in staged milestones.

**Goal:** Build a private, ARM64-ready Personal AI Agent and publish the working foundation to the requested GitHub repository.

**Architecture:** FastAPI serves the web client and authenticated JSON API. PostgreSQL stores conversations and pgvector memories; 9Router routes chat and embedding requests. Docker Compose runs the services, Caddy handles HTTPS, and a scheduled sidecar creates encrypted database backups.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy async, PostgreSQL 16, pgvector 0.8.7, Docker Compose, Caddy, 9Router.

---

## Milestones

1. **Audit and foundations:** Confirm repo state, document scope, establish settings, database models, deployment constraints, and a failing configuration test.
2. **Chat and memory:** Add authenticated chat and conversation APIs, 9Router chat/embedding adapter, PostgreSQL persistence, vector retrieval, and memory controls.
3. **Interface:** Add accessible, responsive web chat with sign-in, conversation history, errors, loading feedback, and memory deletion.
4. **Operations and security:** Harden containers and cookies, add Caddy HTTPS, secret generation, age-encrypted daily backup and guarded restore, and OCI runbook.
5. **Review and publish:** Inspect the final tree, run available checks, create a ZIP without secrets, and commit the reviewed source and archive to the designated GitHub repository.

## Constraints and decisions

- The requested source ZIP was unavailable, so the project is rebuilt from the user's requirements; no existing features were removed.
- 9Router's official Docker image is used as a pinned service. Its dashboard binds only to host loopback; provider and model setup remains an operator action.
- Embedding dimensions are not hard-coded. The memory table uses pgvector's unconstrained vector type and filters by query dimension before cosine ranking.
- This is a single-user private deployment. No public signup, multi-tenant authorization, or arbitrary tool execution is exposed.
- Secrets and database contents are excluded from Git. The age private identity must be stored off-server to restore encrypted dumps.
