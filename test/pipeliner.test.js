import { resolve, join } from 'path'
import { is } from 'uvu/assert'
import { nanoid } from 'nanoid'
import { homedir } from 'os'
import { test } from 'uvu'

import { writeFile, makeDir, appendFile, removeFile, createStdout } from './utils/index.js'
import { prepareFiles } from '../lib/prepare-files.js'
import { gitWorker } from '../lib/git.js'
import { pipeliner } from '../lib/pipeliner.js'

let cwd = join(homedir(), 'nano-staged-' + nanoid())
let stdout = createStdout()

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
}

test.before.each(async () => {
  await makeDir(cwd)
})

test.after.each(async () => {
  stdout.out = ''
  await removeFile(cwd)
})

test('pipeliner run without unstaged files', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])

  let entries = await git.stagedFiles()
  let config = { '*.js': 'echo success' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    repoPath: cwd,
    config,
    files,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m | SUCCESS | echo success\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding up all task modifications to index.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done removing up patch files.\x1B[22m\n'
  )
})

test('pipeliner run with deleted files', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await removeFile(resolve(cwd, 'index.js'))

  let entries = await git.stagedFiles()
  let config = { '*.js': 'echo success' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    repoPath: cwd,
    config,
    files,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Backing up unstaged changes for staged files....\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up unstaged changes.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m | SUCCESS | echo success\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding up all task modifications to index.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Restoring unstaged changes for staged files....\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done restoring up unstaged changes.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done removing up patch files.\x1B[22m\n'
  )
})

test('pipeliner run restor original state', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])

  let entries = await git.stagedFiles()
  let config = { '*.js': 'prettier --write' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  await removeFile(resolve(cwd, 'index.js'))

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    repoPath: cwd,
    config,
    files,
  })

  try {
    await pl.run()
  } catch (error) {
    is(
      stdout.out,
      '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Running tasks...\n' +
        '  \x1B[1m\x1B[31m*.js\x1B[39m\x1B[22m | FAILED  | prettier --write\n' +
        '\x1B[32m-\x1B[39m Restoring to its original state...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done restoring up to its original state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Removing patch files...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done removing up patch files.\x1B[22m\n'
    )
  }
})

test('pipeliner run with changed files', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await writeFile('index.js', 'var a = { };', cwd)

  let entries = await git.stagedFiles()
  let config = { '*.js': 'echo success' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    repoPath: cwd,
    config,
    files,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Backing up unstaged changes for staged files....\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up unstaged changes.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m | SUCCESS | echo success\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding up all task modifications to index.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Restoring unstaged changes for staged files....\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done restoring up unstaged changes.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done removing up patch files.\x1B[22m\n'
  )
})

test('pipeliner run with skiped', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await writeFile('index.js', 'var a = { };', cwd)

  let entries = await git.stagedFiles()
  let config = { '*.ts': 'echo success' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    repoPath: cwd,
    config,
    files,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[33m*.ts\x1B[39m\x1B[22m | SKIPPED | no files matching the pattern were found.\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding up all task modifications to index.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done removing up patch files.\x1B[22m\n'
  )
})

test('pipeliner run with skiped', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await writeFile('index.js', 'var a = { };', cwd)

  let entries = await git.stagedFiles()
  let config = { '*.js': ['eccho success', 'echo success 2'] }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    repoPath: cwd,
    config,
    files,
  })

  try {
    await pl.run()
  } catch (error) {
    is(
      stdout.out,
      '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Backing up unstaged changes for staged files....\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done backing up unstaged changes.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Running tasks...\n' +
        '  \x1B[1m\x1B[31m*.js\x1B[39m\x1B[22m | FAILED  | eccho success\n' +
        '  \x1B[1m\x1B[90m*.js\x1B[39m\x1B[22m | SKIPPED | echo success 2\n' +
        '\x1B[32m-\x1B[39m Restoring to its original state...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done restoring up to its original state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Removing patch files...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done removing up patch files.\x1B[22m\n'
    )
  }
})

test.run()
