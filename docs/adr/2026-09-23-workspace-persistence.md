# Workspace persistence for the implemented demo

Status: Proposed implementation decision, 2026-09-23.

The implemented workspace already defines tasks with nine card fields, teams,
proposals, and one submitted result per proposal. The requested backend persists
these flows without changing the current demo UI or adding AI inference.

Use the canonical Next.js BFF, Zod contracts, and Drizzle/PostgreSQL in
`nextjs_db`. Normalize businesses, tasks, task fields, teams, proposals,
milestones, and score history with foreign keys. Keep public DTOs compatible
with the existing workspace model. No new dependency or separate service.

Task saves include their version and lock the task row before replacing fields
and appending the deterministic score event in the same transaction. A unique
task/team proposal constraint rejects duplicates. Decisions and stage writes
lock the proposal; a unique milestone per proposal makes repeated confirmation
idempotent. Team points are derived from confirmed milestones, including after
a selection is undone; no independently mutable balance is stored.

The request's seven-category strict JSON is the score API contract. It measures
confirmed field coverage using the existing UI weights; it does not claim
semantic AI assessment or implement the older 17-node classifier.

Role and selected team persist in an HTTP-only SameSite cookie. Role switching
is intentionally public in this shared hackathon demo, as specified; this is
not production authentication or organization isolation. Students receive only
published, confirmed card content and their selected team's proposals.

Seed runs explicitly and during local startup, uses stable fictional IDs, and
does not overwrite existing records. UI refresh reloads the database rather
than deleting shared work. Unsaved UI input and local chat remain in memory.

Alternatives rejected: storing the entire workspace as JSON loses relation and
concurrency constraints; implementing the expanded specification now would
introduce unused DTOs and new UI beyond this integration. The demo snapshot
endpoint is intentionally small-volume; larger deployments need paginated
queries, authenticated ownership, and the expanded stage/criteria model.
