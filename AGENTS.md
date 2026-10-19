# Research agent instructions

These rules apply when processing outside technical material for this research system. They do not require running a reading workflow for ordinary source-code edits or README maintenance.

## Required reading capability

For every new paper, blog, report, documentation page, repository or technical note being analyzed for inclusion, read `skills/technical-content-reading/SKILL.md` and its record contract. Apply its material-specific checks. Read the reader-adaptation reference when individual context is supplied.

Keep two paths distinct:

- **Discovery** may store titles, URLs and dates as waiting candidates. It has not performed reading and must not claim skill completion.
- **Research** runs the reading skill and emits a versioned neutral record; existing quality checks and factual/publication review follow before a completed introduction enters the website.

Return a visible hold reason when material or evidence is incomplete. A blog may become an attributed source note; it is not automatically a fully verified paper. Preserve the difference between source claims, analysis, hypotheses, experimental verification and observed work benefit.

## Public and personal outputs

Only public research records and deliberately reviewed public conclusions belong in this repository's research data. Reader profiles, conversations, personalized views, feedback, business materials and credentials stay in user-private storage outside public data and Git commits. A role is an editable starting point, not proof of an individual's knowledge. Never fabricate legacy skill execution records for existing archives.

## Improvement boundary

Feedback proposes versioned changes to material selection, explanation, follow-up questions and work suggestions for the relevant person. Keep facts grounded. Changes affecting other users or the common skill need separate evaluation and adoption; do not automatically reuse one user's raw conversation.

The improver cannot modify evaluation standards, permissions, budgets or publication safeguards. Evaluations use separate examples, retain old/new versions and support rollback. Do not claim RSI effectiveness from merely adding a skill or collecting feedback.

## Current execution boundary

These are agent-facing invocation rules, not an automatic runtime hook. The current GitHub Actions workflow only discovers sources and builds the static website; it does not call a model, execute this skill, or run the feedback/improvement loop. Do not add paid calls, private data or claims of automatic reading without implementing and verifying the corresponding execution path.
