# cc-polymath in this project

This is a pinned reference library shared through Git. The single `hackathon-guide`
in `.agents/skills/` (Codex) and `.claude/skills/` (Claude Code) selects references
on demand. [ROUTING.md](ROUTING.md) maps all 26 library entry points to tasks.

## Implementation context

- Use the root `AGENTS.md`, current code and accepted ADRs. Check versions in
  `scripts/stack-versions.json` and the lockfile before using version-specific examples.
- UI/BFF: `apps/presentation-layer`, Next.js 16 / React 19 / Tailwind 4.
  Routes live in `app/`; FSD implementation lives in `src/`. Reuse shadcn/Radix
  and AI Elements components instead of scaffolding another UI stack.
- AI: `apps/ai-logic-layer` owns Mastra agents, workflows and inference. UI and
  workers call `@mastra/client-js` through `MASTRA_API_URL`. AI SDK stays on major 6.
- Data: UI business data uses Drizzle and `DATABASE_URL_NEXTJS` (`nextjs_db`).
  Mastra and pg-boss use `DATABASE_URL_MASTRA` (`mastra_db`). No cross-database joins.
- Queues: pg-boss major 10; consumers only in `apps/workers`. Producers and
  consumers use the same Mastra database. Shared files use RustFS/S3.
- Migrations: the schema owner generates and commits SQL with `meta/`.
  Other participants apply committed migrations; startup does not generate them.
- Delivery: Bun 1.4.2, Node >=24, `bun install --frozen-lockfile`, `./doctor.sh`,
  `./start.sh`. Run checks appropriate to the change, including `bun run check-types`
  and applicable lint checks for application code. Report unverified live behavior.

Paths above are relative to the repository root. Detailed architecture is in
`docs/ARCHITECTURE.md`; read only the relevant sections.

## Using upstream material

Follow links from the router or catalog to the upstream SKILL.md, then resolve its links
relative to that upstream directory. Read only relevant sections. Older Next.js,
Tailwind or SDK examples must be adapted to the installed versions. Examples using
another ORM, model client, queue or cloud are patterns, not requests to change stacks.

The vendored library's beads, release and publishing workflows are not this team's
workflow. No skill authorizes pushing, deploying, adding infrastructure or expanding
the task. Do not execute bundled scripts without inspecting their purpose and effects.

## Maintaining the shared installation

Edit the shared guide in `scripts/hackathon-guide.md` and both installed guide
copies together. Keep the links in `ROUTING.md` aligned with the vendored library.
`./setup-skills.sh .` checks/recreates missing files offline and refuses to overwrite
different existing files, including teammates' customized skills.

The upstream revision and local adaptations are recorded in `SOURCE.md`; retain
`LICENSE` when updating the bundle. Review changes before updating the pinned revision.
