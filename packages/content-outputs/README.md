# @guilinleolee/dsh-content-outputs

English | [中文](README.zh.md)

Remote gateway over the content-creation outputs library: the read-only projection the Content Studio library view reads, plus the authorized write faces of the workbench columns — information gathering, benchmark accounts, creation, personas, publishing, review, the global template library, and interactions. Each column's storage follows one convention: theme-scoped sidecar manifests (`_<column>.json`) under `outputs/<theme>/assets/`, hidden root-level indexes (`_<column>-index.json`), and `.dsh-output.json` never touched.

The library convention is one directory per creation under the library root (default `<dsh home>/outputs`, override with the `root` config field): finished files sit at the project root, intermediate material lives under `assets/`, and `.dsh-output.json` is the only metadata file (format version 0 — this backend rejects older and newer formats alike). Directory names beginning with `.` or `_` are system entries, never projects. The `contentOutputs/list` Remote scans the root on every call and returns projects in topic order; a malformed or future-format metadata file never hides its directory — the project projects with fallbacks and `hasMetadata: false`, and an unreadable directory is named in `problems`.

## Gather write face

All gather storage lives under `outputs/<theme>/assets/`: the `_gather.json` manifest and `*.html` body snapshots. Paths are guarded (plain theme name, plain file name, traversal rejected); every manifest replacement is quota-trimmed, committed under a file lock with an atomic rename, and on Windows the commit retries the antivirus/indexer pinning codes with backoff; orphaned temp files are swept at gateway start.

- `fetchFeed` fetches and parses one feed document server-side (RSS 2.0, Atom, RDF, JSON Feed) with the source's `ETag`/`Last-Modified` cursors; a 304 returns `notModified` and nothing else. The browser never fetches cross-origin feeds itself.
- `writeAsset` sanitizes `*.html` content through the sanitize-html allowlist and truncates it to the body cap before it reaches disk; other text files pass through with a hard size cap.
- `readGatherManifest` / `writeGatherManifest` read and replace the manifest; entries that fail validation are named in `problems`, and a caller must not write back over a manifest with problems.
- `moveAsset` / `deleteAsset` / `readAsset` cover renames inside one theme, deletion, and text reads.
- `processMaterial` runs one explicit, queued model call (summary, key points, topic score, tags) through the shared `llm` service; rate limits retry with `Retry-After`-aware backoff, and nothing is persisted by the call itself.

Retention: per source, the newest 50 `unread`/`read` materials stay in a theme; `favorite` and `picked` markers and their snapshots are never removed automatically.

## Model Experience

### Explicit one-shot AI remotes

#### What the model sees

Every user click assembles exactly one framed request through the shared `llm` service: material processing, creation generation/rewrite/evaluation, competitor teardowns and reports, persona fill/resume/report, publish adaptation, review diagnosis and period reports, template generate/optimize/extract, and interaction reply drafts, sentiment/intent classification, and insight extraction. Prompts are frozen gateway constants versioned per face (`processMaterial`, `generateCreateContent`, `analyzeCompetitorWork`), inputs are truncated to the configured character cap, and the JSON-contract faces parse strictly with per-field problems; a failed or rate-limited call surfaces to the caller and never blocks the filesystem operations.

#### Token effect

One request per click. The prompt skeletons are fixed constants, so tokens scale with the caller-supplied material excerpt, persona digest, thread lines, or insight batch; batch flows (three creation variants, 50-message classification, 200-message insight batches) pay per request.

#### KV Cache effect

None retained. Every call is an isolated one-shot with no shared conversation prefix, so there is no cross-call cache state to invalidate; the caller owns whatever it stores in the manifests.

## Known Limitations and Deferred Work

- **Projection stays read-only** — `list` never mutates; creating and updating output projects is still the agent's job through its own tools. The gather face writes only `assets/` system files, never deliverables.
- **Deliverable bytes still need a file surface** — the projection carries names and counts only.
- **Fresh format** — `formatVersion 0` manifests and metadata have no compatibility promise, per the repository's pre-release stance.
