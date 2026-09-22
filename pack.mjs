/**
 * pack.mjs — build a shareable release archive for seed users.
 *
 *   node pack.mjs     → dist/dsh-content-studio-<version>.zip
 *
 * The archive is the committed repository layout (packages/ with relative
 * file: deps intact) via `git archive`, so a recipient either unzips and runs
 * `dsh plugin --profile web add file:<dir>/packages/content-studio`, or
 * clones/pulls the repo — both resolve identically.
 */

import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname)
const version = JSON.parse(readFileSync(join(root, 'packages/content-studio/package.json'), 'utf8')).version
const name = `dsh-content-studio-${version}`

const staging = mkdtempSync(join(tmpdir(), 'dsh-cs-pack-'))
const target = join(staging, name)
mkdirSync(target, { recursive: true })

// git archive respects .gitignore and pins committed state — the release is
// exactly what is in version control.
execSync(`git archive HEAD | tar -x -C "${target}"`, { cwd: root, stdio: 'pipe' })

mkdirSync(join(root, 'dist'), { recursive: true })
const out = join(root, 'dist', `${name}.zip`)
rmSync(out, { force: true })
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${target}\\*' -DestinationPath '${out}'"`, { stdio: 'pipe' })
rmSync(staging, { recursive: true, force: true })
console.log(`packed ${out}`)
