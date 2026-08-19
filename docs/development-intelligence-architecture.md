# Nexo Development Intelligence Architecture

## Scope

This extension adds Project Brain, task planning, feedback preferences, codebase impact analysis, a private knowledge workspace, regression and release preparation, and approval-safe automation recipes. It intentionally excludes **Verified Tool Memory**: tool output is never automatically persisted as a learning record.

## Safety model

Every record is owned by one authenticated Supabase user. Each API route verifies the bearer token with `requireVerifiedUser` and always scopes reads, updates, and deletes to that verified user ID. The browser never supplies a trusted ownership value. RLS policies provide a database-level defence in depth layer, while privileged server routes use the service-role client only after request verification.

Repository source content, OAuth credentials, secrets, database values, deployment tokens, and raw tool output are not stored in this workspace. Repository analysis and regression status are calculated on demand from the user’s existing connected integration. Every action that could write to a repository, database, or deployment is represented as a proposal and must remain explicitly approved through Nexo’s existing approval flow.

| Capability | Persistent user data | Read-only input | Write behaviour |
|---|---|---|---|
| Project Brain | Project summaries, conventions, decisions, goals | User-entered notes | Never changes integrations |
| Task Planner | User-created task titles, detail, status, priority | Project Brain context | Workspace-only changes |
| Feedback learning | Explicit preference signals and notes | User feedback only | Never trains or alters the base model |
| Codebase understanding | No source cache | Connected GitHub repository on demand | Read-only analysis |
| Change impact | No source cache | User-selected repository files on demand | Read-only report |
| Knowledge Workspace | User-created private notes | User text only | Workspace-only changes |
| Regression Sentinel | User-requested report summary | Connected repository status on demand | No test/deploy trigger |
| Release Intelligence | User-created release draft and checklist | Workspace data, read-only status | Never deploys or publishes |
| Automation Recipes | Per-user recipe definitions, disabled by default | User-selected context | Pauses before any external write |

## Data model

The migration creates six user-owned tables: `project_brains`, `brain_tasks`, `response_preferences`, `knowledge_entries`, `release_briefs`, and `automation_recipes`. A seventh table, `regression_reports`, stores only the report outcome, title, and safe summary; it never stores source code, credentials, or external logs.

## Product surface

A compact Development Intelligence workspace will open from the top bar. It provides independent sections for Project Brain, planning, preferences, code impact, knowledge, release readiness, and safe recipes. The workspace is responsive and can be closed without changing the existing chat, integrations, settings, or model selector behavior.

## Prompt context

Only the active Project Brain’s concise user-authored summary, conventions, and active task titles may be added to the selected model’s system prompt. This context is clearly labelled as reference data, bounded in length, and cannot override Nexo’s security or approval instructions. Knowledge entries, feedback notes, source content, and tool outputs are not silently injected into model prompts.

## Existing user experience

The extension is empty by default. A user must create a Project Brain or add a note intentionally. Existing users retain all current chat, integration, and profile behavior even if they never open the workspace.
