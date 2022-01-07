import { is } from 'uvu/assert'
import { nanoid } from 'nanoid'
import { resolve } from 'path'
import { homedir } from 'os'
import esmock from 'esmock'
import { test } from 'uvu'

import { makeDir, appendFile, removeFile, createStdout } from './utils/index.js'
import { gitWorker } from '../lib/git.js'
import run from '../lib/runner.js'

let cwd = resolve(homedir(), 'nano-staged-' + nanoid())
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

test('didn’t find git directory', async () => {
  await run({ cwd, stream: stdout })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Nano Staged didn’t find git directory\n'
  )
})

test('create config in package.json', async () => {
  await initGitRepo()
  await run({ cwd, stream: stdout })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Create Nano Staged config.\n'
  )
})

test('config file not found', async () => {
  await initGitRepo()
  await run({ cwd, stream: stdout, config: cwd })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Nano Staged config file \x1B[33m' +
      cwd +
      '\x1B[39m is not found.\n'
  )
})

test('config invalid', async () => {
  await initGitRepo()
  await appendFile(
    'package.json',
    `{
      "nano-staged": {}
    }`,
    cwd
  )
  await run({ cwd, stream: stdout })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n\x1B[36m-\x1B[39m Nano Staged config invalid\n'
  )
})

test('staging area is empty', async () => {
  await initGitRepo()
  await appendFile(
    'package.json',
    `{
      "nano-staged": {
        "*.js": "prettier --write"
      }
    }`,
    cwd
  )
  await run({ cwd, stream: stdout })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n\x1B[36m-\x1B[39m Git staging area is empty.\n'
  )
})

test('unstaging area is empty', async () => {
  await initGitRepo()
  await appendFile(
    'package.json',
    `{
      "nano-staged": {
        "*.js": "prettier --write"
      }
    }`,
    cwd
  )
  await execGit(['add', '--', 'package.json'])
  await run({ cwd, stream: stdout, unstaged: true })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n\x1B[36m-\x1B[39m Git unstaging area is empty.\n'
  )
})

test('no files match any configured task', async () => {
  await initGitRepo()
  await appendFile(
    'package.json',
    `{
      "nano-staged": {
        "*.css": "prettier --write"
      }
    }`,
    cwd
  )
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', '--', 'index.js'])
  await run({ cwd, stream: stdout })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m No files match any configured task.\n'
  )
})

test('run cmd error', async () => {
  try {
    await initGitRepo()
    await appendFile(
      'nano-staged.json',
      `{
        "*.js": "eccho success"
      }`,
      cwd
    )
    await appendFile('index.js', 'var test = {};', cwd)
    await execGit(['add', '--', 'index.js'])
    await run({ cwd, stream: stdout })
  } catch (error) {
    is(
      stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
      'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
        '\x1B[2m  \x1B[90m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Running tasks...\n' +
        '  \x1B[1m\x1B[31m*.js\x1B[39m\x1B[22m | FAILED  | eccho success\n' +
        '\x1B[32m-\x1B[39m Restoring to its original state...\n' +
        '\x1B[2m  \x1B[90m»\x1B[39m Done restoring up to its original state.\x1B[22m\n' +
        '\x1B[32m-\x1B[39m Removing patch files...\n' +
        '\x1B[2m  \x1B[90m»\x1B[39m Done removing up patch files.\x1B[22m\n' +
        '\n' +
        '\x1B[31meccho success:\n' +
        '\x1B[39meccho does not exist\n'
    )
  }
})

test('run git error', async () => {
  const run = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      gitWorker: () => ({
        async getRepoAndDotGitPaths() {
          return Promise.reject('Git error')
        },
      }),
    },
  })

  try {
    await run({ cwd, stream: stdout })
  } catch (error) {
    is(error, 'Git error')
  }
})

test('run all success', async () => {
  await initGitRepo()
  await appendFile(
    'nano-staged.json',
    `{
        "*.js": "echo success"
     }`,
    cwd
  )
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', '--', 'index.js'])

  await run({ cwd, stream: stdout })

  is(
    stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[90m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m | SUCCESS | echo success\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[90m»\x1B[39m Done adding up all task modifications to index.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch files...\n' +
      '\x1B[2m  \x1B[90m»\x1B[39m Done removing up patch files.\x1B[22m\n'
  )
})

test.run()
