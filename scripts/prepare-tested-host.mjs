/** Point an isolated development checkout at the declared source Host. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const environment = JSON.parse(fs.readFileSync(path.join(root, 'tested-environment.json'), 'utf8'))
const supplied = process.env.DSH_HARNESS
assert(supplied, 'Set DSH_HARNESS to the declared, independently installed Core source checkout')
const core = fs.realpathSync(supplied)
assert.notEqual(core, root)
assert.equal(JSON.parse(fs.readFileSync(path.join(core, 'package.json'), 'utf8')).version, environment.core.version)
assert.equal(process.versions.node, environment.node)

const pnpm = path.join(core, 'node_modules/pnpm/bin/pnpm.mjs')
assert.equal(execFileSync(process.execPath, [pnpm, '--version'], { encoding: 'utf8' }).trim(), environment.pnpm)
const packages = JSON.parse(execFileSync(process.execPath, [pnpm, 'list', '-r', '--depth', '-1', '--json'], {
  cwd: core,
  encoding: 'utf8',
  maxBuffer: 4 * 1024 * 1024,
  windowsHide: true,
}))
// The pinned pnpm workspace hoists its YAML parser here after Core installation.
const yaml = createRequire(path.join(core, 'node_modules/.pnpm/node_modules/yaml/package.json'))('.')
const file = path.join(root, 'pnpm-workspace.yaml')
const workspace = yaml.parse(fs.readFileSync(file, 'utf8'))
workspace.overrides ??= {}
for (const entry of packages) {
  if (typeof entry.name === 'string' && entry.name.startsWith('@deepseek-ai/')) {
    workspace.overrides[entry.name] = 'link:' + entry.path.replaceAll('\\', '/')
  }
}
// The provider and tests read the exact pi-ai already selected by this Host.
const llm = packages.find(entry => entry.name === '@deepseek-ai/dsh-llm-pi-ai')
assert(llm, 'The source Host must contain dsh-llm-pi-ai')
const piRoot = fs.realpathSync(path.join(llm.path, 'node_modules/@earendil-works/pi-ai'))
assert.equal(JSON.parse(fs.readFileSync(path.join(piRoot, 'package.json'), 'utf8')).name, '@earendil-works/pi-ai')
workspace.overrides['@earendil-works/pi-ai'] = 'link:' + piRoot.replaceAll('\\', '/')
fs.writeFileSync(file, yaml.stringify(workspace))
console.log('Prepared current source Host dependencies for this isolated checkout')
