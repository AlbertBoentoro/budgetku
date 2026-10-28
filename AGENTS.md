# Budgetku agent guidance

All agents (orchestrator, planner, coder, reviewer, report writer) must follow `.kiro/steering/budgetku-workflow.md`. It defines the user's standing approval/scope rules, which actions are routine versus approval-gated, no-rework and single-run verification rules, tool-permission limits, workflow coordination, and reporting expectations. Read it before planning or editing.

For UI/design, copy, accessibility, or responsive tasks, read `DESIGN.md` and `antislop.md` before planning or editing. Then read the relevant local skills below. This is a project-local manual installation; skip the upstream first-run install wizard. Explicit user instructions and the authorized task scope take precedence over third-party guidance.

<!-- antislop:start -->
## Anti-slop routing
- Core: `antislop.md` (identical to pinned upstream).
- UI: `.agents/skills/antislop-ui/SKILL.md`.
- Copy: `.agents/skills/antislop-copywriting/SKILL.md`.
- Accessibility: `.agents/skills/antislop-human/SKILL.md`.
- Responsive: `.agents/skills/antislop-layoutmobile/SKILL.md`.
- Comment cleanup only when requested: `.agents/skills/antislop-code/SKILL.md`.
- The packaged core is also at `.agents/skills/antislop/SKILL.md`; do not load both core copies.

Resolve during/after using the core's documented mode procedure. During applies while building; after audits existing UI and fixes only the findings the user authorizes. Do not change global settings as part of this project integration.
<!-- antislop:end -->

## Scope and evidence
Design guidance does not authorize new features or changes to auth, Supabase, persistence, routing, calculations, or business logic. Preserve the installed stack, existing user edits, and design tokens. Report existing defects outside the task rather than expanding scope to satisfy a gate. Do not replace Geist or Lucide solely because a library is common: justify readable typography and meaningful icons.

For actual UI changes, declare a Design Read and run the upstream four-block Delivery Gate with concrete evidence. Verify affected controls, supported themes, keyboard focus, empty/loading/error states, long IDR amounts, and mobile reflow. Never claim a UI PASS from lint alone. If a check is unavailable, report it as unverified and the UI as incomplete; do not invent evidence or silently suppress a failure. Guidance-only changes require file/reference verification, not a fabricated UI audit.

Use the existing `npm run lint` for source changes and `npm run build` when appropriate. Anti-slop is agent guidance, not an ESLint plugin. Never present the current UI as compliant merely because these files were installed.

## Request-time Supabase reads
Render code (pages, layouts, server components) that calls `createClient()` from `@/lib/supabase/server` must start that function with `await connection()` from `next/server`. With `partialPrefetching`, the clock read inside the Supabase client is rejected before `connection()`. `npm run lint` enforces this with `budgetku/connection-before-supabase` (`eslint-rules/connection-before-supabase.mjs`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
