/**
 * sync.mjs — rebuild the distribution packages from a deepseek-harness
 * checkout. Run from this repo's root:
 *
 *   node sync.mjs [path-to-deepseek-harness]
 *
 * The harness checkout must have the three source packages built
 * (`pnpm run build` there). This script copies each package's built `lib/`,
 * READMEs, license-facing metadata, and `cordis.patch.yml` into
 * `packages/<name>/`, rewriting the `@deepseek-ai/` scope to `@guilinleolee/`
 * and converting the studio's sibling peers into relative `file:` deps so a
 * single `dsh plugin add file:<repo>/packages/content-studio` installs the
 * whole feature. Peers that the host DSH provides at runtime stay untouched.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const harness = resolve(process.argv[2] ?? 'D:/deepseek-harness')
const root = resolve(import.meta.dirname)

const SCOPE_FROM = '@deepseek-ai/'
const SCOPE_TO = '@guilinleolee/'

/** source package dir in the harness → distribution package dir name here. */
const PACKAGES = [
  { src: 'packages/client/ui-content-studio', dist: 'content-studio' },
  { src: 'packages/creation/content-outputs', dist: 'content-outputs' },
  { src: 'packages/creation/content-schedule', dist: 'content-schedule' },
]

const rescope = (text) => text
  .replaceAll('@deepseek-ai/dsh-client-ui-content-studio', `${SCOPE_TO}dsh-content-studio`)
  .replaceAll('@deepseek-ai/dsh-content-outputs', `${SCOPE_TO}dsh-content-outputs`)
  .replaceAll('@deepseek-ai/dsh-content-schedule', `${SCOPE_TO}dsh-content-schedule`)

for (const pkg of PACKAGES) {
  const from = join(harness, pkg.src)
  const to = join(root, 'packages', pkg.dist)
  if (!existsSync(join(from, 'lib/client.js')) && pkg.dist === 'content-studio') {
    throw new Error(`built bundle missing — run \`pnpm run build\` in ${harness} first`)
  }
  rmSync(to, { recursive: true, force: true })
  mkdirSync(to, { recursive: true })

  // Built artifacts + sources (MIT honesty) + docs + patch.
  cpSync(join(from, 'lib'), join(to, 'lib'), { recursive: true })
  cpSync(join(from, 'src'), join(to, 'src'), { recursive: true })
  for (const file of ['README.md', 'README.zh.md', 'cordis.patch.yml']) {
    writeFileSync(join(to, file), rescope(readFileSync(join(from, file), 'utf8')))
  }

  // Manifest: rescope names, keep host-provided peers (dropping the invalid
  // outside-workspace `workspace:` protocol — the host satisfies them), turn
  // the two sibling gateways into relative file deps so one `dsh plugin add`
  // on the studio materializes the whole feature into the profile.
  const manifest = JSON.parse(readFileSync(join(from, 'package.json'), 'utf8'))
  const name = rescope(manifest.name)
  const peers = JSON.parse(rescope(JSON.stringify(manifest.peerDependencies, null, 2)))
  for (const key of Object.keys(peers)) peers[key] = '*'
  const next = {
    name,
    version: manifest.version,
    description: manifest.description,
    type: 'module',
    main: manifest.main,
    types: manifest.types,
    exports: JSON.parse(rescope(JSON.stringify(manifest.exports, null, 2))),
    dsh: JSON.parse(rescope(JSON.stringify(manifest.dsh, null, 2))),
    scripts: { },
    license: manifest.license,
    dependencies: name.endsWith('content-studio')
      ? {
          [`${SCOPE_TO}dsh-content-outputs`]: 'file:../content-outputs',
          [`${SCOPE_TO}dsh-content-schedule`]: 'file:../content-schedule',
        }
      : {},
    peerDependencies: peers,
    files: manifest.files,
  }
  if (name.endsWith('content-studio')) {
    delete next.peerDependencies[`${SCOPE_TO}dsh-content-outputs`]
    delete next.peerDependencies[`${SCOPE_TO}dsh-content-schedule`]
  }
  writeFileSync(join(to, 'package.json'), `${JSON.stringify(next, null, 2)}\n`)
  console.log(`synced ${name}`)
}

console.log('done — commit the result, then recipients run:')
console.log('  dsh plugin --profile web add file:<this repo>/packages/content-studio')
