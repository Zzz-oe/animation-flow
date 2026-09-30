# Project Instructions

Before every development task, read `docs/EVALUATION.md` in full and use it as the acceptance baseline. Also read `docs/DEVELOPMENT_SPEC.md` for the current implementation stage and `docs/WORKLOG.md` for relevant prior decisions.

After each development session:

- Update `docs/DEVELOPMENT_LOG.md` with completed work, verification, decisions, AI coding tools, real token usage, and human time spent.
- Update `docs/WORKLOG.md` when a durable decision, lesson, failure case, or reusable insight should carry forward.
- Update `docs/DEVELOPMENT_SPEC.md` when stage status or acceptance criteria change.
- Keep model, testing, deployment, timing, and token claims evidence-based.
- Preserve the animation-specific human-AI workflow as the first priority. Mock mode must remain usable without credentials.
- When a stage meets its exit criteria and its verification passes, create one Git commit for that completed stage. Do not bundle an incomplete stage merely to create activity.

## Recording token usage (mandatory, every session)

Token usage is measurable on this machine and must no longer be reported as "unknown" while the data source is available.

- Run `node scripts/token-usage.mjs --out <file.md>` at the end of every development session; it auto-locates the newest session record of the current workspace.
- Data source: WorkBuddy session records at `~/.workbuddy/projects/<workspace-slug>/<sessionId>.jsonl`. Every API round stores a `usage` object containing `input_tokens`, `output_tokens`, `total_tokens` and `cache_read_input_tokens`.
- Caliber (verified against the raw records): `total_tokens = input_tokens + output_tokens`, and `cache_read_input_tokens` is a **subset** of `input_tokens` (the cache-hit portion). Never add cache reads on top of input again.
- Put the real numbers in the session entry of `docs/DEVELOPMENT_LOG.md`, and append one row to `docs/TOKEN_USAGE.md`.
- A reading taken mid-session is partial. Take the final reading at the end of the session and state the sampling time.

The project uses `main` as its primary branch and `origin` as the GitHub remote: https://github.com/Zzz-oe/animation-flow.git
