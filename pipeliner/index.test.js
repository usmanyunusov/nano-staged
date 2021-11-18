import { realpathSync } from 'fs'
import { is } from 'uvu/assert'
import { resolve } from 'path'
import { test } from 'uvu'
import os from 'os'

import { writeFile, makeDir, appendFile, removeFile, createStdout } from '../test/utils/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { gitWorker } from '../git/index.js'
import { pipeliner } from './index.js'

let osTmpDir = process.env.APPVEYOR ? 'C:\\projects' : realpathSync(os.tmpdir())
let cwd = resolve(osTmpDir, `nano-staged-run`)

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

  let entries = await git.getStagedFiles()
  let config = { '*.js': 'prettier --write' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    config,
    files,
    cwd,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '\x1B[32m  •\x1B[39m\n' +
      '\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m prettier --write\n' +
      '\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding all task modifications to index\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch file...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
  )
})

test('pipeliner run with deleted files', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await removeFile(resolve(cwd, 'index.js'))

  let entries = await git.getStagedFiles()
  let config = { '*.js': 'prettier --write' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    config,
    files,
    cwd,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done caching and removing unstaged changes\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '\x1B[32m  •\x1B[39m\n' +
      '\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m prettier --write\n' +
      '\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding all task modifications to index\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Restoring unstaged changes for staged files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done deleting removed and restoring changed files\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch file...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
  )
})

test('pipeliner run restor original state', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])

  let entries = await git.getStagedFiles()
  let config = { '*.js': 'prettier --write' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  await removeFile(resolve(cwd, 'index.js'))

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    cwd,
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
        '\x1B[31m  •\x1B[39m\n' +
        '\n' +
        '  \x1B[1m\x1B[31m*.js\x1B[39m\x1B[22m prettier --write\n' +
        '\n' +
        '\x1B[32m-\x1B[39m Restoring original state...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done restoring\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Removing patch file...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
    )
  }
})

test('pipeliner run with changed files', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await writeFile('index.js', 'var a = { };', cwd)

  let entries = await git.getStagedFiles()
  let config = { '*.js': 'prettier --write' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    config,
    files,
    cwd,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done caching and removing unstaged changes\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '\x1B[32m  •\x1B[39m\n' +
      '\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m prettier --write\n' +
      '\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding all task modifications to index\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Restoring unstaged changes for staged files...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done deleting removed and restoring changed files\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch file...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
  )
})

test('pipeliner run with skiped', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await writeFile('index.js', 'var a = { };', cwd)

  let entries = await git.getStagedFiles()
  let config = { '*.ts': 'prettier --write' }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    config,
    files,
    cwd,
  })

  await pl.run()

  is(
    stdout.out,
    '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '\x1B[33m  •\x1B[39m\n' +
      '\n' +
      '  \x1B[1m\x1B[33m*.ts\x1B[39m\x1B[22m no staged files matching the pattern were found\n' +
      '\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding all task modifications to index\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch file...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
  )
})

test('pipeliner run with skiped', async () => {
  let git = gitWorker(cwd)

  await initGitRepo()
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])
  await writeFile('index.js', 'var a = { };', cwd)

  let entries = await git.getStagedFiles()
  let config = { '*.js': ['pretstier --write', 'prettier --write'] }
  let files = prepareFiles({ entries, config, repoPath: cwd, cwd })

  let pl = pipeliner({
    dotGitPath: resolve(cwd, '.git'),
    stream: stdout,
    config,
    files,
    cwd,
  })

  try {
    await pl.run()
  } catch (error) {
    is(
      stdout.out,
      '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Backing up unstaged changes for staged files...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done caching and removing unstaged changes\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Running tasks...\n' +
        '\x1B[31m  •\x1B[39m\x1B[90m  •\x1B[39m\n' +
        '\n' +
        '  \x1B[1m\x1B[31m*.js\x1B[39m\x1B[22m pretstier --write\n' +
        '  \x1B[1m\x1B[90m*.js\x1B[39m\x1B[22m prettier --write\n' +
        '\n' +
        '\x1B[32m-\x1B[39m Restoring original state...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done restoring\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Removing patch file...\n' +
        '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
    )
  }
})

test.run()