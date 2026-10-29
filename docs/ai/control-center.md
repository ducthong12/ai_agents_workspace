# AgentWork trace, budget guard and brand documents

## Request and behavior
Identify existing Claude Desktop AgentWork sessions from ticket titles; observe the exact session log, including shared multi-ticket sessions. Keep existing Codex sessions and task phases unchanged. Trace distinguishes recent activity, an ended response, waiting and suspected stale activity; it never declares a process dead from inactivity alone.

Enforce a remaining 20% boundary before website-controlled AI handoffs. Check destination account quota, an existing destination session context and source session context where supplied. Unknown/older-than-five-minute observations pause the transfer. Exactly 20% is allowed. Codex quota comes from Desktop and context from the latest token_count/model window. Claude Desktop percentages require the authenticated Trace form until a verified automatic telemetry source is available. No credential scraping or hidden fallback to another AI.

Collect relevant Markdown from brand repositories under the configured work root into TN_AI_DOCS_ROOT/brand/repository. Preserve original files, retain locally edited copies, separate duplicate repo names and keep copied docs if a repo disappears. The documents page groups/counts by brand, renders 50 cards per batch and fetches selected content on demand. Search still includes content on the server.

## Files
brand-docs.mjs, budget.mjs, claude-desktop.mjs, trace.mjs, studio.mjs, tasks.mjs, runner.mjs, server.mjs, public/app.js, public/trace-view.js, public/style.css and SETUP.md.

## Verification
72 automated tests pass: budget threshold/staleness/missing values, separate session contexts, no dispatch when blocked, resumed dispatch idempotency, AgentWork exact ticket matching and redaction, response vs thinking/activity detection, actual context parsing, brand copy/conflict preservation and existing checks. Local collection produced 88 documents from 34 repos across 15 labels, with zero conflicts/errors. Live UI verified the Castrol filter (13 documents), selected content fetched on demand, the exact AgentWork IDs/status for ABCORE-281, and native Codex quota (51% remaining at the check). No task was started or message sent for QA.

## Configuration and limits
See ../../SETUP.md. Quota observations, login hashes, MCP config, raw logs and brand document contents are local data excluded from Git. The guard cannot prevent manual prompts outside the website or stop an already running Desktop model. More than five minutes without meaningful log activity is a suspected wait, not proof of a hung process.
