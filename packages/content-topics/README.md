# @guilinleolee/dsh-content-topics

English | [中文](README.zh.md)

Topic-bank Remote for the content-creation library: `contentTopics/list|put|delete` over one system file — `_topics.json` at the outputs library root (default `<dsh home>/outputs`, override with the `root` config field). The `_` prefix keeps the outputs scanner treating it as a system entry, so the library directory stays the single content-creation surface on disk the agent can also read.

A topic is one creation idea carried through the pipeline: title, one-line pitch, `idea → todo → creating → done → shelved` status, provenance (`manual`, `gather`, or `benchmark` plus a source id, the original URL, and a create-time title/summary capture so a dead link never takes the evidence with it), free-form tags and description, an optional 0–10 score (manual or AI; per-factor breakdowns are a reserved shape), a planned `YYYY-MM-DD`, a link to a `_schedule.json` calendar entry, and a link to an `outputs/<topic>/` project directory. `createdAt`/`updatedAt` are store-managed — clients never send them; `put` upserts by id alone (absent or unknown id creates; ids are generated UUIDs; the stored `createdAt` survives an update), and `delete` by id is a no-op for unknown ids. `list` returns items sorted by `updatedAt`, newest first. Every method reads or commits the file under the atomic-write writer lock, so reads stay lock-free and concurrent writers serialize. Validation follows the outputs rule: one malformed stored record is named in `problems` and skipped, never silently dropped, and a file with an unsupported `formatVersion` loads as an empty bank with that problem surfaced.

## Model Experience

None, as the package reads and writes the topic file for client display; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No agent-side tools** — the model cannot read or steer the topic bank yet; that needs a capability Consumer (tool) or a context plugin, deliberately deferred until a use shows which shape fits.
- **Score factors are reserved** — manual scores carry `factors: null`; the per-factor breakdown exists for a later AI-scoring phase and is validated but never produced here.
- **Free-form identity** — `put` accepts any non-empty string id (identity is id alone); only gateway-minted ids are UUIDs, and `scheduleItemId`/`refId` are unchecked strings pointing into other packages' stores.
- **Fresh format** — `formatVersion 0` has no compatibility promise, per the repository's pre-release stance.
