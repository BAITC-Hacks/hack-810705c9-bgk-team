# 002 — Gravity icons in the AI-Sana workspace

Status: Accepted — requested by the project owner, 2026-09-23.

The visible workspace uses `@gravity-ui/icons` React components. Keep the existing shadcn/Radix components and use Gravity glyphs for functional controls; no Gravity UI component framework is introduced. Decorative icons are removed where text already explains the action.

Lucide remains installed for unused generated shadcn and AI Elements components. Replacing that entire library is outside this frontend demo change; migrate a component when it is brought into the visible workspace. The dependency and resolved version are recorded together in the app package and `bun.lock`.
