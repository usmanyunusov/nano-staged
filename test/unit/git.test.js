import { equal, is } from 'uvu/assert'
import { join, resolve } from 'path'
import { test } from 'uvu'
import fs from 'fs-extra'

import { writeFile, makeDir, appendFile, fixture, removeFile } from './utils/index.js'
import { create_git } from '../../lib/git.js'

const cwd = fixture('simple/git-test')
const patchPath = join(cwd, 'nano-staged.patch')

async function execGit(args) {
  const git = create_git(cwd)
  await git.exec(args, { cwd })
}

test.before.each(async (ctx) => {
  await makeDir(cwd)
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n', cwd)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])

  ctx.git = create_git(cwd)
})

test.after.each(async () => {
  await removeFile(cwd)
})

test('should return "null" when git dir is not found', async ({ git }) => {
  git.exec = async () => {
    throw Error()
  }

  const paths = await git.paths()

  is(paths.root, null)
  is(paths.dot, null)
})

test('should return "null" when run error', async ({ git }) => {
  git.exec = async () => Promise.reject()

  const paths = await git.paths({ cwd })

  is(paths.root, null)
  is(paths.dot, null)
})

test('should return path when git dir is found', async ({ git }) => {
  const paths = await git.paths()

  is(paths.root, fixture('simple/git-test'))
  is(
    paths.dot,
    process.platform === 'win32'
      ? fixture('simple/git-test') + '\\.git'
      : fixture('simple/git-test') + '/.git'
  )
})

test('should create patch to file', async ({ git }) => {
  await writeFile('README.md', '# Test\n## Test', cwd)
  await git.diff_patch(patchPath)

  const patch = await fs.readFile(patchPath)
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

test('should create patch to files', async ({ git }) => {
  await appendFile('a.js', 'let a = {};', cwd)
  await git.add(join(cwd, 'a.js'))
  await removeFile(join(cwd, 'a.js'))
  await git.diff_patch(patchPath, [join(cwd, 'a.js')])

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

test('should checkout to files', async ({ git }) => {
  await appendFile('a.js', 'let a = {};', cwd)
  await git.add('.')
  await writeFile('a.js', 'let b = {};', cwd)
  await git.checkout(join(cwd, 'a.js'))

  is(await git.status(), 'A  a.js\x00')
})

test('should apply to patch file', async ({ git }) => {
  await writeFile('README.md', '# Test\n## Test', cwd)
  await git.diff_patch(patchPath)
  await git.apply(patchPath)

  is((await fs.stat(patchPath)).isFile(), true)
})

test('should error when not apply patch file', async ({ git }) => {
  try {
    await git.apply('test.patch', true)
  } catch (error) {
    is(error, "error: can't open patch 'test.patch': No such file or directory")
  }
})

test('should add to files', async ({ git }) => {
  await appendFile('a.js', 'let a = {};', cwd)
  await git.add(['.'])

  is(await git.status(), 'A  a.js\x00')
})

test('should parse status correctly', async ({ git }) => {
  await appendFile('a.js', 'let a = {};', cwd)
  await appendFile('b.js', 'let a = {};', cwd)
  await git.add(['b.js'])

  is(await git.status(), 'A  b.js\x00?? a.js\x00')

  git.exec = async () => {
    throw new Error('fatal: not a git repository (or any of the parent directories): .git')
  }
  is(await git.status(), '')
})

test('should get diff file correctly', async ({ git }) => {
  git.exec = async () => 'a.js\x00b.js\x00'

  equal(await git.diff_name(['main', 'origin/main'], { staged: false, filter: 'M' }), [
    resolve(cwd, 'a.js'),
    resolve(cwd, 'b.js'),
  ])
})

test('should get staged files correctly', async ({ git }) => {
  git.exec = async () => 'a.js\x00b.js\x00'
  equal(await git.diff_name([], { staged: true, filter: 'ACMR' }), [
    resolve(cwd, 'a.js'),
    resolve(cwd, 'b.js'),
  ])

  git.exec = async () => ''
  equal(await git.diff_name([], { staged: true, filter: 'ACMR' }), [])
})

test('should get unstaged files correctly', async ({ git }) => {
  git.exec = async () => 'a.js\x00b.js\x00'

  equal(await git.diff_name([], { staged: false, filter: 'M' }), [
    resolve(cwd, 'a.js'),
    resolve(cwd, 'b.js'),
  ])
})

test('should get empty array', async ({ git }) => {
  git.exec = async () => {
    throw Error('fails')
  }

  equal(await git.diff_name([], { staged: true, filter: 'M' }), [])
})

test('should handle git worktrees', async ({ git }) => {
  const work_tree_dir = resolve(cwd, 'worktree')

  await git.exec(['branch', 'test'])
  await git.exec(['worktree', 'add', work_tree_dir, 'test'])

  equal(await git.paths({ cwd: work_tree_dir }), {
    root: fixture('simple/git-test/worktree'),
    dot: fixture('simple/git-test/.git/worktrees/worktree'),
  })
})

test('should get uncommitted files', async ({ git }) => {
  git.status = async () =>
    '?? new.js\x00A  stage.js\x00MM mod.js\x00AM test/add.js\x00RM rename.js\x00origin.js\x00CM' +
    ' test/copy.js\x00test/base.js\x00MD remove.js\x00D  delete.js\x00'

  equal(await git.uncommitted_files(), [
    resolve(cwd, 'mod.js'),
    resolve(cwd, 'test/add.js'),
    resolve(cwd, 'rename.js'),
    resolve(cwd, 'test/copy.js'),
    resolve(cwd, 'remove.js'),
  ])
})

test.run()
