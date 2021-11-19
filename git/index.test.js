import { equal, is } from 'uvu/assert'
import { join } from 'path'
import esmock from 'esmock'
import { test } from 'uvu'
import fs from 'fs-extra'

import { writeFile, makeDir, appendFile, fixture, removeFile } from '../test/utils/index.js'
import { gitWorker } from './index.js'

let cwd = fixture('git/nano-staged-git')
let patchPath = join(cwd, 'nano-staged.patch')

async function execGit(args) {
  let git = gitWorker(cwd)
  await git.exec(args, { cwd })
}

test.before(async () => {
  await makeDir(cwd)
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n', cwd)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
  await writeFile('README.md', '# Test\n## Test', cwd)
})

test.after(async () => {
  await removeFile(cwd)
})

test('not found git dir', async () => {
  const { gitWorker } = await esmock('./index.js', {
    '../utils/index.js': {
      findUp: () => undefined,
    },
  })

  let git = gitWorker(cwd)
  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(repoPath, null)
  is(dotGitPath, null)
})

test('found git dir', async () => {
  const { gitWorker } = await esmock('./index.js', {
    '../utils/index.js': {
      findUp: () => 'test',
    },
  })

  let git = gitWorker(cwd)
  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(repoPath, 'test')
  is(dotGitPath, 'test/.git')
})

test('create patch file', async () => {
  let git = gitWorker(cwd)

  await git.diffPatch(patchPath)

  let source = await fs.readFile(patchPath)
  is(
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

test('checkout files', async () => {
  let git = gitWorker(cwd)

  await git.checkout(['.'])

  let files = await git.getStagedFiles()
  equal(files, [])
})

test('apply patch file', async () => {
  let git = gitWorker(cwd)

  await git.applyPatch(patchPath, true)
  is((await fs.stat(patchPath)).isFile(), true)
})

test('not apply patch file', async () => {
  let git = gitWorker(cwd)

  try {
    await git.applyPatch('test.patch')
  } catch (error) {
    is(error, "error: can't open patch 'test.patch': No such file or directory\n")
  }
})

test('add files', async () => {
  let git = gitWorker(cwd)

  await git.add(['.'])

  let files = await git.getStagedFiles()
  is(files.length, 2)
})

test('parse status', async () => {
  let git = gitWorker(cwd)
  let status =
    'MM mod.js\x00AM test/add.js\x00RM rename.js\x00origin.js\x00CM' +
    ' test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'

  git.exec = async () => status

  equal(await git.getStagedFiles(), [
    { path: 'mod.js', rename: undefined, type: 2 },
    { path: 'test/add.js', rename: undefined, type: 2 },
    { path: 'origin.js', rename: 'rename.js', type: 2 },
    { path: 'test/base.js', rename: 'test/copy.js', type: 2 },
    { path: 'remove.js', rename: undefined, type: 4 },
  ])
})

test('parse status empty', async () => {
  let git = gitWorker(cwd)

  git.exec = async () => ''
  equal(await git.getStagedFiles(), [])
})

test('parse fail status', async () => {
  let git = gitWorker(cwd)

  git.exec = async () => ' '
  equal(await git.getStagedFiles(), [])

  git.exec = async () => 'M   rename.js'
  equal(await git.getStagedFiles(), [])

  git.exec = async () => 'RM  rename.js'
  equal(await git.getStagedFiles(), [])

  git.exec = async () => '     '
  equal(await git.getStagedFiles(), [])

  git.exec = async () => {
    throw new Error('fatal: not a git repository (or any of the parent directories): .git')
  }
  equal(await git.getStagedFiles(), [])
})

test.run()
