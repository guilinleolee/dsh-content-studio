# @guilinleolee/dsh-content-studio

English | [中文](README.zh.md)

Content Studio plugin: the sidebar entry plus the frame-wide creation workbench surface. The entry fills the sidebar shell's `sidebar.footer.action` hole (labeled row while the column is wide, icon on the rail), and the workbench fills the frame's additive `shell.overlay` hole, so both registrations are additive chrome — nothing shipped is replaced.

Install into any DSH web profile with one command: `dsh plugin --profile web add @guilinleolee/dsh-content-studio` — the package declares `dsh.bundle.patch`, whose insert list brings its two host Remote gateways (`content-outputs`, `content-schedule`) along, so nothing else is manual.

The plugin is a **self-contained Remote assembly**: `apply` mounts its own host contributions (`contentOutputs`, `contentSchedule`) through `ctx.remote.$mount()` — the pattern api-remotes established — so the browser bundle carries its whole server face and no in-tree BFF assembly needs to know this plugin exists.

The workbench has three top-level views. **Create** is the dual-intent capability menu: the finished-artifact tab groups verbs by medium (visual & cards, writing, video, audio), and the operation tab groups them by process stage (discover & topics, plan & positioning, publish & quality gate, data & review). Every capability carries a maturity badge — **Verified**, **Ready**, **Needs setup**, **Incoming** — so a pick sets expectations before it runs. Picking copies a structured instruction template (【…】 fill-in markers) to the clipboard; the paste-into-session hop is the user's one action because no composer-draft seam exists yet. **Library** reads the agent's outputs library through the `contentOutputs/list` Remote (`@guilinleolee/dsh-content-outputs`) and renders one read-only card per project directory — status badge, medium, platform, tags, deliverable and asset counts — with missing-metadata projects kept visible under a repair hint and unreadable directories named in a problems banner. **Calendar** reads and mutates the publication calendar (`contentSchedule/list|put|delete`, `@guilinleolee/dsh-content-schedule`) over a Monday-first month grid: clicking a day opens an inline add form, and each item chip offers mark-published and remove — every action commits through the Remote and re-renders from the returned snapshot.

Escape or the header close button dismisses the surface; closed state renders null while the slot entry stays mounted. Both target slots are declared by other plugins, so `apply` installs both registrations atomically through one `slots.inject()` generator for the declaration lifetime, and the components share one open/close controller injected into each.

The **Gather** view (信息收集) is the information-collection surface: RSS/Atom source management (add, edit, enable, test connection, keyword excludes, OPML import with a preview that marks duplicates and folders, and a token-warning OPML export), collection tasks (per-task source set, theme binding, keyword filters, per-run cap, optional interval, and a 20-entry run log), and a two-pane material library backed by the on-disk `_gather.json` manifest. Materials support read/favorite/picked markers, excerpt snippets, theme rebinding, an explicit AI-processing button (summary, points, score, tags — always manual), pushing a material into the create view as a reference line (never the body), and adding it to the publication calendar. Scheduling runs only while the workbench is open — a master tick, visibility-aware pause/resume, and a single overdue catch-up on open; closing the workbench stops every timer, and the copy states this plainly. Sources, tasks, and logs live in browser storage under `content-studio.gather.` through one storage module; clearing browser data loses only those, never the materials.

## Model Experience

Explicit only: the gather view's AI-processing button sends one framed request per click through the `contentOutputs/processMaterial` Remote, which rides the shared `llm` service. A failed or rate-limited call leaves the material untouched and shows a retry affordance; nothing here reaches a model request otherwise.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No composer hand-off** — picking a capability copies the instruction instead of prefilling a session draft; a runtime draft/prefill seam would remove the paste hop.
- **The capability catalog is static** — menu items are shipped data, not derived from the mounted skill registry, so maturity badges must be maintained by hand until a catalog RPC exists.
- **The library is read-only** — renaming, retitling, or publishing projects happens through the agent, not this surface; no file content transfer exists either.
- **Single-surface state** — open/closed state lives in one controller instance per apply; the surface is not per-session and holds no session context.
