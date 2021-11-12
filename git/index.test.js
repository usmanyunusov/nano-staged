import { spawn } from '../utils/index.js'
import { dirname, join, resolve } from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { execGit, gitWorker } from './index.js'

let currentDir = dirname(fileURLToPath(import.meta.url))
let cwd = resolve(currentDir, '../test/fixtures/git/nano-staged-test')

async function appendFile(filename, content, dir = cwd) {
  await fs.appendFile(resolve(dir, filename), content)
}

async function writeFile(filename, content, dir = cwd) {
  await fs.writeFile(resolve(dir, filename), content)
}

async function makeDir() {
  await fs.mkdir(cwd)
}

async function exGit(args) {
  await execGit(args, { cwd })
}

async function initGitRepo() {
  await exGit(['init'])
  await exGit(['config', 'user.name', '"test"'])
  await exGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n')
  await exGit(['add', 'README.md'])
  await exGit(['commit', '-m initial commit'])
  await writeFile('README.md', '# Test\n## Test')
}

await makeDir()
await initGitRepo()

test('gitWorker: diffPatch', async () => {
  let git = gitWorker({ cwd })

  let patchPath = join(cwd, 'nano-staged.patch')
  await git.diffPatch(patchPath)

  let source = await fs.readFile(patchPath)
  equal(
    source.toString(),
    'diff --git a/README.md b/README.md\n' +
      'index 8ae0569..a07c500 100644\n' +
      '--- a/README.md\n' +
      '+++ b/README.md\n' +
      '@@ -1,0 +2 @@\n' +
      '+## Test\n' +
      '\\ No newline at end of file\n'
  )
})

test('gitWorker: checkout, checkPatch, applyPatch', async () => {
  let git = gitWorker({ cwd })

  let patchPath = join(cwd, 'nano-staged.patch')
  await git.checkout(['.'])

  let source = await fs.readFile(join(cwd, 'README.md'))
  equal(source.toString(), '# Test\n')

  await git.checkPatch(patchPath)
  await git.applyPatch(patchPath)
  source = await fs.readFile(join(cwd, 'README.md'))
  equal(source.toString(), '# Test\n## Test')
})

test('', async () => {
  await fs.rm(cwd, { recursive: true })
})

test.run()
