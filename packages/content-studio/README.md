# @guilinleolee/dsh-content-studio

English | [中文](README.zh.md)

Content Studio plugin: the sidebar entry plus the frame-wide creation workbench surface. The entry fills the sidebar shell's `sidebar.footer.action` hole (labeled row while the column is wide, icon on the rail), and the workbench fills the frame's additive `shell.overlay` hole, so both registrations are additive chrome — nothing shipped is replaced.

Install into any DSH web profile with one command: `dsh plugin --profile web add @guilinleolee/dsh-content-studio` — the package declares `dsh.bundle.patch`, whose insert list brings its two host Remote gateways (`content-outputs`, `content-schedule`) along, so nothing else is manual.

The plugin is a **self-contained Remote assembly**: `apply` mounts its own host contributions (`contentOutputs`, `contentSchedule`) through `ctx.remote.$mount()` — the pattern api-remotes established — so the browser bundle carries its whole server face and no in-tree BFF assembly needs to know this plugin exists.

The workbench has three top-level views. **Create** is the dual-intent capability menu: the finished-artifact tab groups verbs by medium (visual & cards, writing, video, audio), and the operation tab groups them by process stage (discover & topics, plan & positioning, publish & quality gate, data & review). Every capability carries a maturity badge — **Verified**, **Ready**, **Needs setup**, **Incoming** — so a pick sets expectations before it runs. Picking copies a structured instruction template (【…】 fill-in markers) to the clipboard; the paste-into-session hop is the user's one action because no composer-draft seam exists yet. **Library** reads the agent's outputs library through the `contentOutputs/list` Remote (`@guilinleolee/dsh-content-outputs`) and renders one read-only card per project directory — status badge, medium, platform, tags, deliverable and asset counts — with missing-metadata projects kept visible under a repair hint and unreadable directories named in a problems banner. **Calendar** reads and mutates the publication calendar (`contentSchedule/list|put|delete`, `@guilinleolee/dsh-content-schedule`) over a Monday-first month grid: clicking a day opens an inline add form, and each item chip offers mark-published and remove — every action commits through the Remote and re-renders from the returned snapshot.

Escape or the header close button dismisses the surface; closed state renders null while the slot entry stays mounted. Both target slots are declared by other plugins, so `apply` installs both registrations atomically through one `slots.inject()` generator for the declaration lifetime, and the components share one open/close controller injected into each.

## Model Experience

None, as the surface is browser chrome; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No composer hand-off** — picking a capability copies the instruction instead of prefilling a session draft; a runtime draft/prefill seam would remove the paste hop.
- **The capability catalog is static** — menu items are shipped data, not derived from the mounted skill registry, so maturity badges must be maintained by hand until a catalog RPC exists.
- **The library is read-only** — renaming, retitling, or publishing projects happens through the agent, not this surface; no file content transfer exists either.
- **Single-surface state** — open/closed state lives in one controller instance per apply; the surface is not per-session and holds no session context.
