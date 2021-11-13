import { dirname, join, resolve } from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { gitWorker } from './index.js'

let currentDir = dirname(fileURLToPath(import.meta.url))
let cwd = resolve(currentDir, '../test/fixtures/git/nano-staged-test')
let patchPath = join(cwd, 'nano-staged.patch')

async function appendFile(filename, content, dir = cwd) {
  await fs.appendFile(resolve(dir, filename), content)
}

async function writeFile(filename, content, dir = cwd) {
  await fs.writeFile(resolve(dir, filename), content)
}

async function makeDir(dir = cwd) {
  await fs.mkdir(dir)
}

async function execGit(args) {
  let git = gitWorker({ cwd })
  await git.exec(args, { cwd })
}

async function initGitRepo() {
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n')
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
  await writeFile('README.md', '# Test\n## Test')
}

test.before(async () => {
  await makeDir()
  await initGitRepo()
})

test.after(async () => {
  await fs.rm(cwd, { recursive: true })
})

test('gitWorker: diffPatch', async () => {
  let git = gitWorker({ cwd })

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

test('gitWorker: checkout', async () => {
  let git = gitWorker({ cwd })

  await git.checkout(['.'])

  let files = await git.getStagedFiles({ gitDir: cwd, cwd })
  equal(files, [])
})

test('gitWorker: applyPatch', async () => {
  let git = gitWorker({ cwd })

  await git.applyPatch(patchPath)

  let source = await fs.readFile(join(cwd, 'README.md'))
  equal(source.toString(), '# Test\n## Test')
})

test('gitWorker: add', async () => {
  let git = gitWorker({ cwd })

  await git.add(['.'])

  let files = await git.getStagedFiles({ gitDir: cwd, cwd })
  equal(files.length, 2)
})

test('gitWorker: checkPatch', async () => {
  let git = gitWorker({ cwd })

  equal(await git.checkPatch(patchPath), true)
  await writeFile(patchPath, '')
  equal(await git.checkPatch(patchPath), false)
})

test.run()
