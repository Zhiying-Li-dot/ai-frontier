# Research record contract v1

Skill identity: `technical-content-reading`, version `1.0.0`. This is the normative agent output contract. The local workbench enforces it in `local/record.ts`; the static publishing workflow still does not automatically invoke this skill.

## Neutral record

Use exactly these top-level keys in `record.json`. Empty arrays and explicit unknown/not-tested states are valid. Do not put a private person's role, employer, problem details, conversation or API credentials in this record.

| Key | Required content |
| --- | --- |
| `schemaVersion` | `1.0` |
| `skill` | `{ "id": "technical-content-reading", "version": "1.0.0" }` |
| `source` | `id`, `kind`, `title`, `version`, `scope`, `locatorMode`, `synthetic`, `materials` |
| `readingQuestion` | A neutral research question; unknown if none is established |
| `problem` | `task`, `comparison`, `successMeasure`, `assumptions` |
| `mechanism` | `inputs`, `steps`, `outputs`, `unresolved` |
| `claims` | Claim records below |
| `evidence` | Evidence records below |
| `context` | `mode`, `relatedWork`, `noveltyStatus` |
| `limitations` | `authorStated`, `analystIdentified` |
| `nextResearch` | `hypothesis`, `minimalTest`, `falsifier`, `executionStatus` |
| `transfer` | `conditions`, `workBenefitStatus`, `unknowns` |
| `execution` | `steps`, `externalChecksPerformed`, `experimentsPerformed` |
| `publication` | `decision`, `tier`, `blockingGaps`, `qualifications` |

Unknown text values use `null`; lists use `[]`. Explain consequential unknowns in the corresponding gap list. A source ID alone is not a verified author identity or publication date.

### Source and actual coverage

- `kind`: `paper`, `blog`, `report`, `documentation`, `code`, `technical-note`, or `other`.
- `scope`: `metadata`, `abstract`, `partial`, or `full`.
- `locatorMode`: `page`, `structure`, or `source-limited`; reliable PDF page index is required for page locators.
- `synthetic`: boolean; true for every supplied evaluation fixture.
- Each `materials` entry: `id`, `kind` (`body`, `figure`, `table`, `appendix`, `code`, `data`), `availability` (`present`, `missing`, `not-applicable`), `inspection` (`read`, `unread`, `not-applicable`), `locator`, `reason`.
- If `availability` is `missing`, `inspection` is `unread`. If `availability` is `not-applicable`, `inspection` is also `not-applicable`, with a reason establishing why the material does not exist for this source. If `availability` is `present`, `inspection` records `read` or `unread` according to the actual action. Missing code/data stays missing/unread even when it is not required for an attributed source note.
- Inventory each main figure/table separately. Mark appendices inapplicable only when this source has none, not because the agent did not obtain them. No figures/tables means explicit inapplicable records with reasons, not invented counts.

### Claims and evidence

Each claim has `id`, `text`, `provenance`, `evidenceIds`, `conditions`, `supportStatus`, `unsupportedInterpretation`.

- `provenance`: `source-report`, `external-fact`, `analysis`, or `hypothesis`.
- `supportStatus`: `reported-only`, `supported-in-source`, `independently-tested`, or `unresolved`.
- `source-report` means the author said it; it does not confirm the claim's truth.
- An `external-fact` requires an actually checked external source in evidence. No external check means no such claim.
- `independently-tested` requires an actual experiment plus recorded configuration/results; restating, inspecting code, another model's agreement or a JSON check does not qualify.

Each evidence entry has `id`, `locator`, `observation`, `kind`, `conditions`, `missingControls`. `kind` is `statement`, `experiment`, `proof`, `implementation`, or `independent-test`. IDs are unique within their array; each claim's `evidenceIds` resolves to existing evidence. Essential numbers match the supplied source, including units, denominators and uncertainty when available.

`context.mode`: `source-only`, `targeted-external`, or `externally-checked`. `noveltyStatus` is `unverified` unless actual prior-work checks support a specific bounded comparison. Do not infer “first” from absence of related work in a blog.

### Eight observable step outcomes

`execution.steps` contains exactly one entry for each stable ID, in order:

`purpose`, `source`, `problem`, `mechanism`, `evidence`, `context`, `validation`, `transfer`.

Each entry has `id`, `status` (`done`, `blocked`, `not-applicable`), `output`, `reason`. A completed assessment can conclude that evidence is missing; this does not turn missing evidence into inspected material. A blocked mechanism step remains blocked if its core description is absent. Record visible actions and artifacts, never hidden chain of thought.

`nextResearch.executionStatus`: `not-run`, `run`, or `not-applicable`. `transfer.workBenefitStatus`: `not-tested`, `offline-tested`, or `observed-in-work`; a hypothetical suggestion is `not-tested`.

### Publication levels

- `decision`: `hold` or `review-ready`; publishing is a separate authorized action.
- `tier`: `candidate`, `source-note`, `research-analysis`, or `independent-validation`.
- Abstract-only papers: `hold` / `candidate`.
- Full blogs: can propose `source-note` with unverified claims attributed and qualified. Missing paper-specific apparatus is not itself a blocker.
- Full technical analyses: core materials inspected and central claims linked; no unresolved contradiction that invalidates the proposed conclusion.
- `independent-validation`: actual independently performed tests; never assign based only on reading.
- Synthetic fixtures: always `hold`; the tier may describe the supported depth, but it never authorizes publishing fictional content.

Before any real handoff, exclude private reader context, retain AI assistance attribution, and apply the existing research/publication validation. Passing this record contract does not certify scientific truth or implement that integration.

## Private reader view

When reader context is supplied, create a separate `audience-view.json` containing `schemaVersion`, `researchRef` (source/version and record fingerprint if available), `readerContextRef`, `policyVersion`, `explanation`, `prerequisites`, `workSuggestion`, `applicabilityConditions`, `unknowns`, `suggestedFeedback`.

Never invent a fingerprint, policy history or confirmed preference. Missing refs use null. Work suggestions remain hypotheses until actual outcomes exist. Keep this file in a user-private workspace outside public `cloud-data/`, `public/` and Git commits; do not auto-upload it as part of skill evaluation or research publishing.
