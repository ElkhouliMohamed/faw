# Agent instructions

Before any change, read [REBUILD-PLAN.md](REBUILD-PLAN.md): it holds the fixed product decisions, the phase status, how to resume an interrupted phase, the test commands and the definition of done.

- Work only on the `rebuild/v2` branch. Never push, never touch `main` or the live server.
- Uncommitted changes are an interrupted phase: finish them, don't discard them.
- One commit per phase, then update the status table in REBUILD-PLAN.md.
- Local setup: [DEV-SETUP.md](DEV-SETUP.md).
