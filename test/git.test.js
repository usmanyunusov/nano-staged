import { equal, is } from 'uvu/assert'
import { join } from 'path'
import { test } from 'uvu'
import fs from 'fs-extra'

import { writeFile, makeDir, appendFile, fixture, removeFile } from './utils/index.js'
import { gitWorker } from '../lib/git.js'

let cwd = fixture('git/nano-staged-git')
let patchPath = join(cwd, 'nano-staged.patch')

async function execGit(args) {
  let git = gitWorker(cwd)
  await git.exec(args, { cwd })
}

test.before.each(async () => {
  await makeDir(cwd)
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n', cwd)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
})

test.after.each(async () => {
  await removeFile(cwd)
})

test('not found git dir', async () => {
  let git = gitWorker(cwd)
  git.exec = async () => null

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(repoPath, null)
  is(dotGitPath, null)
})

test('not found git dir', async () => {
  let git = gitWorker(cwd)
  git.exec = async () => Promise.reject()

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(repoPath, null)
  is(dotGitPath, null)
})

test('resolve git dir', async () => {
  let git = gitWorker(cwd)
  git.exec = async () => 'test'

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

  is(repoPath, 'test')
  is(dotGitPath, process.platform === 'win32' ? 'test\\.git' : 'test/.git')
})

test('create patch file', async () => {
  let git = gitWorker(cwd)

  await writeFile('README.md', '# Test\n## Test', cwd)
  await git.diff(patchPath)

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

test('create patch file for files', async () => {
  let git = gitWorker(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await git.add(join(cwd, 'a.js'))
  await removeFile(join(cwd, 'a.js'))
  await git.diff(patchPath, [join(cwd, 'a.js')])

  let source = await fs.readFile(patchPath)

  is(
    source.toString(),
    'diff --git a/a.js b/a.js\n' +
      'deleted file mode 100644\n' +
      'index 36b56ef..0000000\n' +
      '--- a/a.js\n' +
      '+++ /dev/null\n' +
      '@@ -1 +0,0 @@\n' +
      '-let a = {};\n' +
      '\\ No newline at end of file\n'
  )
})

test('checkout files', async () => {
  let git = gitWorker(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await git.add('.')
  await writeFile('a.js', 'let b = {};', cwd)
  await git.checkout(join(cwd, 'a.js'))

  let files = await git.stagedFiles()
  equal(files, [{ x: 65, y: 32, path: 'a.js', rename: undefined, type: 1 }])
})

test('apply patch file', async () => {
  let git = gitWorker(cwd)

  await writeFile('README.md', '# Test\n## Test', cwd)
  await git.diff(patchPath)
  await git.apply(patchPath)

  is((await fs.stat(patchPath)).isFile(), true)
})

test('not apply patch file', async () => {
  let git = gitWorker(cwd)

  try {
    await git.apply('test.patch', true)
  } catch (error) {
    is(error, "error: can't open patch 'test.patch': No such file or directory\n")
  }
})

test('add files', async () => {
  let git = gitWorker(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await git.add(['.'])

  let files = await git.stagedFiles()

  equal(files, [{ x: 65, y: 32, path: 'a.js', rename: undefined, type: 1 }])
})

test('parse status', async () => {
  let git = gitWorker(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await appendFile('b.js', 'let a = {};', cwd)
  await git.add(['b.js'])

  let files = await git.status()
  equal(files, [
    { x: 65, y: 32, path: 'b.js', rename: undefined },
    { x: 63, y: 63, path: 'a.js', rename: undefined },
  ])
})

test('parse status empty', async () => {
  let git = gitWorker(cwd)

  git.exec = async () => ''
  equal(await git.status(), [])
})

test('parse fail status', async () => {
  let git = gitWorker(cwd)

  git.exec = async () => ' '
  equal(await git.status(), [])

  git.exec = async () => 'M   rename.js'
  equal(await git.status(), [])

  git.exec = async () => 'RM  rename.js'
  equal(await git.status(), [])

  git.exec = async () => '     '
  equal(await git.status(), [])

  git.exec = async () => {
    throw new Error('fatal: not a git repository (or any of the parent directories): .git')
  }
  equal(await git.status(), [])
})

test('parse stagedFiles', async () => {
  let git = gitWorker(cwd)
  let status =
    'MM mod.js\x00AM test/add.js\x00RM rename.js\x00origin.js\x00CM' +
    ' test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'

  git.exec = async () => status

  equal(await git.stagedFiles(), [
    { x: 77, y: 77, path: 'mod.js', rename: undefined, type: 2 },
    { x: 65, y: 77, path: 'test/add.js', rename: undefined, type: 2 },
    { x: 82, y: 77, path: 'origin.js', rename: 'rename.js', type: 2 },
    { x: 67, y: 77, path: 'test/base.js', rename: 'test/copy.js', type: 2 },
    { x: 77, y: 68, path: 'remove.js', rename: undefined, type: 4 },
  ])
})

test('parse unstagedFiles', async () => {
  let git = gitWorker(cwd)
  let status =
    'A  add.js\x00AD add_remove.js\x00MM mod.js\x00?? test/add.js\x00RM rename.js\x00origin.js\x00CM' +
    ' test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'

  git.exec = async () => status

  equal(await git.unstagedFiles(), [
    { x: 65, y: 68, path: 'add_remove.js', rename: undefined, type: 4 },
    { x: 77, y: 77, path: 'mod.js', rename: undefined, type: 2 },
    { x: 63, y: 63, path: 'test/add.js', rename: undefined, type: 2 },
    { x: 82, y: 77, path: 'origin.js', rename: 'rename.js', type: 2 },
    { x: 67, y: 77, path: 'test/base.js', rename: 'test/copy.js', type: 2 },
    { x: 77, y: 68, path: 'remove.js', rename: undefined, type: 4 },
  ])
})

test.run()
