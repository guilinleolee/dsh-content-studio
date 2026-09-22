# @guilinleolee/dsh-content-outputs

English | [中文](README.zh.md)

Read-only Remote projection of the content-creation outputs library — the on-disk surface the agent (and its skills) write finished work into, and the Content Studio library view reads.

The library convention is one directory per creation under the library root (default `<dsh home>/outputs`, override with the `root` config field): finished files sit at the project root, intermediate material lives under `assets/`, and `.dsh-output.json` is the only metadata file (format version 0 — this backend rejects older and newer formats alike). Directory names beginning with `.` or `_` are system entries, never projects. The `contentOutputs/list` Remote scans the root on every call and returns projects in topic order; a malformed or future-format metadata file never hides its directory — the project projects with fallbacks and `hasMetadata: false`, and an unreadable directory is named in `problems`.

## Model Experience

None, as the package reads the outputs library for client display; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Read-only** — no write or mutation Remote exists yet; creating and updating projects is the agent's job through its own tools.
- **No file content transfer** — the projection carries names and counts only; downloading deliverable bytes needs a separate file-serving surface.
- **Fresh format** — `formatVersion 0` has no compatibility promise, per the repository's pre-release stance.
