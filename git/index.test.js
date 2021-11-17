import { promises as fs, realpathSync } from 'fs'
import { equal, is } from 'uvu/assert'
import { join, resolve } from 'path'
import { test } from 'uvu'
import sinon from 'sinon'
import os from 'os'

import { writeFile, makeDir, appendFile, fixture, removeFile } from '../test/utils/index.js'
import { gitWorker } from './index.js'

let cwd = fixture('git/nano-staged-test')
let patchPath = join(cwd, 'nano-staged.patch')
let osTmpDir = process.env.APPVEYOR ? 'C:\\projects' : realpathSync(os.tmpdir())

async function execGit(args) {
  let git = gitWorker(cwd)
  await git.exec(args, { cwd })
}

async function initGitRepo() {
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n', cwd)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
  await writeFile('README.md', '# Test\n## Test', cwd)
}

test.before(async () => {
  await makeDir(cwd)
  await initGitRepo()
})

test.after(async () => {
  await removeFile(cwd)
})

test('gitWorker: fail find git repo', async () => {
  let cwd = resolve(osTmpDir, `nano-staged`)
  let git = gitWorker(cwd)

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(!!repoPath, false)
  is(!!dotGitPath, false)
})

test('gitWorker: should find git repo', async () => {
  let git = gitWorker(process.cwd())

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(!!repoPath, true)
  is(!!dotGitPath, true)
})

test('gitWorker: should create diff patch file', async () => {
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

test('gitWorker: should checkout files', async () => {
  let git = gitWorker(cwd)

  await git.checkout(['.'])

  let files = await git.getStagedFiles()
  equal(files, [])
})

test('gitWorker: should apply patch file', async () => {
  let git = gitWorker(cwd)

  await git.applyPatch(patchPath)

  let source = await fs.readFile(join(cwd, 'README.md'))
  is(source.toString(), '# Test\n## Test')
})

test('gitWorker: should check patch file', async () => {
  let git = gitWorker(cwd)

  is(await git.checkPatch(patchPath), true)
  await writeFile(patchPath, '', cwd)
  is(await git.checkPatch(patchPath), false)
})

test('gitWorker: fail apply patch file', async () => {
  let git = gitWorker(cwd)

  try {
    await git.applyPatch('test.patch')
  } catch (error) {
    is(error, "error: can't open patch 'test.patch': No such file or directory\n")
  }
})

test('gitWorker: should add files', async () => {
  let git = gitWorker(cwd)

  await git.add(['.'])

  let files = await git.getStagedFiles()
  is(files.length, 2)
})

test('getStagedFiles: should return array of file names', async () => {
  let git = gitWorker(cwd)
  sinon
    .mock(git)
    .expects('exec')
    .callsFake(
      async () =>
        'MM mod.js\x00AM test/add.js\x00RM rename.js\x00origin.js\x00CM test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'
    )

  equal(await git.getStagedFiles(), [
    { path: 'mod.js', rename: undefined, type: 2 },
    { path: 'test/add.js', rename: undefined, type: 2 },
    { path: 'origin.js', rename: 'rename.js', type: 2 },
    { path: 'test/base.js', rename: 'test/copy.js', type: 2 },
    { path: 'remove.js', rename: undefined, type: 4 },
  ])
})

test('getStagedFiles: should return empty array when no staged files', async () => {
  let git = gitWorker(cwd)
  sinon
    .mock(git)
    .expects('exec')
    .callsFake(async () => '')

  equal(await git.getStagedFiles(), [])
})

test('getStagedFiles: should return empty array when no staged files', async () => {
  let git = gitWorker(cwd)
  sinon
    .mock(git)
    .expects('exec')
    .callsFake(async () => ' ')

  equal(await git.getStagedFiles(), [])
})

test('getStagedFiles: should return empty array when fail parse', async () => {
  let git = gitWorker(cwd)
  sinon
    .mock(git)
    .expects('exec')
    .callsFake(async () => 'M   rename.js')

  equal(await git.getStagedFiles(), [])
  sinon.restore()

  sinon
    .mock(git)
    .expects('exec')
    .callsFake(async () => 'RM  rename.js')

  equal(await git.getStagedFiles(), [])
  sinon.restore()

  sinon
    .mock(git)
    .expects('exec')
    .callsFake(async () => '     ')

  equal(await git.getStagedFiles(), [])
  sinon.restore()

  sinon
    .mock(git)
    .expects('exec')
    .callsFake(async () => {
      throw new Error('fatal: not a git repository (or any of the parent directories): .git')
    })

  equal(await git.getStagedFiles(), [])
  sinon.restore()
})

test.run()
