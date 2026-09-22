/**
 * release.mjs — one-command release. Run from this repo root:
 *
 *   node release.mjs            → pack + tag v<version> + push tag + GitHub Release with the zip
 *   node release.mjs --no-push  → pack + local tag only (inspect before pushing)
 *
 * Version comes from packages/content-studio/package.json — bump it there
 * BEFORE releasing when the release deserves a new number. Everything is
 * derived from that single field; no placeholders anywhere.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname)
const noPush = process.argv.includes('--no-push')

const sh = (cmd) => execSync(cmd, { cwd: root, stdio: 'pipe' }).toString().trim()

const version = JSON.parse(readFileSync(join(root, 'packages/content-studio/package.json'), 'utf8')).version
const tag = `v${version}`
const zip = `dist/dsh-content-studio-${version}.zip`

// Precondition: the working tree is committed — the zip pins HEAD via git archive.
if (sh('git status --porcelain') !== '') {
  console.error('release: working tree is dirty — commit first (the zip archives HEAD)')
  process.exit(1)
}
// Reuse an existing zip only when it was built from the current HEAD; pack.mjs
// is cheap, so simply rebuild to guarantee the asset matches the tag.
sh('node pack.mjs')

if (sh(`git tag -l ${tag}`) !== '') {
  console.error(`release: tag ${tag} already exists — bump the version in packages/content-studio/package.json`)
  process.exit(1)
}
sh(`git tag ${tag}`)

if (noPush) {
  console.log(`release: local tag ${tag} created (${zip}) — push with: git push origin main ${tag}`)
  process.exit(0)
}

sh('git push origin HEAD:main')
sh(`git push origin ${tag}`)
const notes = [
  `内容创作工作台 ${tag}`,
  '',
  '安装（解压后）：',
  '```sh',
  'dsh plugin --profile web add file:<解压目录>/packages/content-studio',
  'dsh web',
  '```',
].join('\n')
sh(`gh release create ${tag} ${zip} --title "${tag}" --notes "${notes.replace(/"/g, '\\"')}"`)
console.log(`release: ${tag} published — https://github.com/guilinleolee/dsh-content-studio/releases/tag/${tag}`)
