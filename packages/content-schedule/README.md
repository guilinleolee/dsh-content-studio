# @guilinleolee/dsh-content-schedule

English | [中文](README.zh.md)

Publication calendar Remote for the content-creation library: `contentSchedule/list|put|delete` over one system file — `_schedule.json` at the outputs library root (default `<dsh home>/outputs`, override with the `root` config field). The `_` prefix keeps the outputs scanner treating it as a system entry, so the library directory stays the single content-creation surface on disk the agent can also read.

An item is one day-entry: title, `YYYY-MM-DD` (+ optional `HH:mm`), platform, `idea → draft → scheduled → published` status, content-or-event kind, an optional link to an outputs-project topic, and the published URL once live. `put` upserts by id alone (absent or unknown id creates; ids are generated UUIDs); `delete` by id is a no-op for unknown ids. Every method reads or commits the file under the atomic-write writer lock, so reads stay lock-free and concurrent writers serialize. Validation follows the outputs rule: one malformed stored record is named in `problems` and skipped, never silently dropped, and a file with an unsupported `formatVersion` loads as an empty calendar with that problem surfaced.

## Model Experience

None, as the package reads and writes the calendar file for client display; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No agent-side tools** — the model cannot read or steer the calendar yet; that needs a capability Consumer (tool) or a context plugin, deliberately deferred until a use shows which shape fits.
- **No platform/venue auto-fill** — platforms are free-text; no catalog or validation against platform constraints exists yet.
- **Fresh format** — `formatVersion 0` has no compatibility promise, per the repository's pre-release stance.
