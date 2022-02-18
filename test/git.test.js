import { equal, is } from 'uvu/assert'
import { join } from 'path'
import { test } from 'uvu'
import fs from 'fs-extra'

import { writeFile, makeDir, appendFile, fixture, removeFile } from './utils/index.js'
import { createGit } from '../lib/git.js'

let cwd = fixture('simple/git-test')
let patchPath = join(cwd, 'nano-staged.patch')

async function execGit(args) {
  let git = createGit(cwd)
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

test('should return "null" when git dir is not found', async () => {
  let git = createGit(cwd)
  git.exec = async () => null

  let git_paths = await git.getGitPaths()

  is(git_paths.root, null)
  is(git_paths.dot, null)
})

test('should return "null" when run error', async () => {
  let git = createGit(cwd)
  git.exec = async () => Promise.reject()

  let git_paths = await git.getGitPaths()

  is(git_paths.root, null)
  is(git_paths.dot, null)
})

test('should return path when git dir is found', async () => {
  let git = createGit(cwd)
  git.exec = async () => 'test'

  let git_paths = await git.getGitPaths()

  is(git_paths.root, 'test')
  is(git_paths.dot, process.platform === 'win32' ? 'test\\.git' : 'test/.git')
})

test('should create patch to file', async () => {
  let git = createGit(cwd)

  await writeFile('README.md', '# Test\n## Test', cwd)
  await git.diff(patchPath)

  let patch = await fs.readFile(patchPath)
  is(
    patch.toString(),
    'diff --git a/README.md b/README.md\n' +
      'index 8ae0569..a07c500 100644\n' +
      '--- a/README.md\n' +
      '+++ b/README.md\n' +
      '@@ -1,0 +2 @@\n' +
      '+## Test\n' +
      '\\ No newline at end of file\n'
  )
})

test('should create patch to files', async () => {
  let git = createGit(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await git.add(join(cwd, 'a.js'))
  await removeFile(join(cwd, 'a.js'))
  await git.diff(patchPath, [join(cwd, 'a.js')])

  let patch = await fs.readFile(patchPath)
  is(
    patch.toString(),
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

test('should checkout to files', async () => {
  let git = createGit(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await git.add('.')
  await writeFile('a.js', 'let b = {};', cwd)
  await git.checkout(join(cwd, 'a.js'))

  equal(await git.status(), [{ x: 65, y: 32, path: 'a.js', rename: undefined }])
})

test('should apply to patch file', async () => {
  let git = createGit(cwd)

  await writeFile('README.md', '# Test\n## Test', cwd)
  await git.diff(patchPath)
  await git.apply(patchPath)

  is((await fs.stat(patchPath)).isFile(), true)
})

test('should error when not apply patch file', async () => {
  let git = createGit(cwd)

  try {
    await git.apply('test.patch', true)
  } catch (error) {
    is(error, "error: can't open patch 'test.patch': No such file or directory\n")
  }
})

test('should add to files', async () => {
  let git = createGit(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await git.add(['.'])

  equal(await git.status(), [{ x: 65, y: 32, path: 'a.js', rename: undefined }])
})

test('should parse status correctly', async () => {
  let git = createGit(cwd)

  await appendFile('a.js', 'let a = {};', cwd)
  await appendFile('b.js', 'let a = {};', cwd)
  await git.add(['b.js'])

  equal(await git.status(), [
    { x: 65, y: 32, path: 'b.js', rename: undefined },
    { x: 63, y: 63, path: 'a.js', rename: undefined },
  ])

  git.exec = async () => ''
  equal(await git.status(), [])

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

test('should diff to file correctly', async () => {
  let git = createGit(cwd)

  is(await git.diffFileName(), '')

  await writeFile('README.md', '# Test\n## Test', cwd)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m change README.md'])

  is(await git.diffFileName('HEAD', 'HEAD^1'), 'README.md\x00')

  git.exec = async () => {
    throw new Error('Error')
  }

  is(await git.diffFileName(), '')
})

test('should get diff file correctly', async () => {
  let git = createGit(cwd)

  git.diffFileName = async () => 'add.js\x00'
  equal(await git.changedFiles(), { working: ['add.js'], deleted: [], changed: ['add.js'] })

  git.diffFileName = async () => ''
  equal(await git.changedFiles(), { working: [], deleted: [], changed: [] })
})

test('should get staged files correctly', async () => {
  let git = createGit(cwd)

  git.exec = async () =>
    '?? new.js\x00A  stage.js\x00MM mod.js\x00AM test/add.js\x00RM rename.js\x00origin.js\x00CM' +
    ' test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'

  equal(await git.stagedFiles(), {
    working: ['stage.js', 'mod.js', 'test/add.js', 'rename.js', 'test/copy.js', 'remove.js'],
    deleted: ['remove.js'],
    changed: ['mod.js', 'test/add.js', 'rename.js', 'test/copy.js'],
  })
})

test('should get unstaged files correctly', async () => {
  let git = createGit(cwd)

  git.exec = async () =>
    'A  add.js\x00AD add_remove.js\x00MM mod.js\x00?? test/add.js\x00RM rename.js\x00origin.js\x00CM' +
    ' test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'

  equal(await git.unstagedFiles(), {
    working: ['mod.js', 'test/add.js', 'rename.js', 'test/copy.js'],
    deleted: [],
    changed: ['mod.js', 'test/add.js', 'rename.js', 'test/copy.js'],
  })
})

test.run()
