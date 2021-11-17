import { realpathSync } from 'fs'
import { is } from 'uvu/assert'
import { resolve } from 'path'
import { test } from 'uvu'
import os from 'os'

import { makeDir, appendFile, removeFile } from '../test/utils/index.js'
import { createReporter } from '../create-reporter/index.js'
import { gitWorker } from '../git/index.js'
import run from './index.js'

let osTmpDir = process.env.APPVEYOR ? 'C:\\projects' : realpathSync(os.tmpdir())
let cwd = resolve(osTmpDir, `nano-staged-run`)

let stdout = { out: '' }
stdout.write = (symbols) => {
  stdout.out += symbols
}

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
  let reporter = createReporter({ stream: stdout })

  await run({ cwd, reporter })

  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Nano Staged didn’t find git directory\n'
  )
})

test('create config in package.json', async () => {
  let reporter = createReporter({ stream: stdout })

  await initGitRepo()
  await run({ cwd, reporter })

  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Create Nano Staged config in package.json\n'
  )
})

test('config invalid', async () => {
  let reporter = createReporter({ stream: stdout })

  await initGitRepo()
  await appendFile(
    'package.json',
    `{
      "nano-staged": {
        
      }
    }`,
    cwd
  )

  await run({ cwd, reporter })

  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n\x1B[36m-\x1B[39m Nano Staged config invalid\n'
  )
})

test('staging area is empty', async () => {
  let reporter = createReporter({ stream: stdout })

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

  await run({ cwd, reporter })

  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n\x1B[36m-\x1B[39m Git staging area is empty.\n'
  )
})

test('staging area is empty', async () => {
  let reporter = createReporter({ stream: stdout })

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
  await execGit(['add', 'index.js'])

  await run({ cwd, reporter })

  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m No staged files match any configured task.\n'
  )
})

test('run success', async () => {
  let reporter = createReporter({ stream: stdout })

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
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])

  await run({ cwd, reporter })

  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[32m*.js\x1B[39m\x1B[22m prettier --write\n' +
      '\x1B[32m-\x1B[39m Applying modifications...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done adding all task modifications to index\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch file...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n'
  )
})

test('run cmd error', async () => {
  let reporter = createReporter({ stream: stdout })

  await initGitRepo()
  await appendFile(
    'package.json',
    `{
      "nano-staged": {
        "*.js": "psrettier --write"
      }
    }`,
    cwd
  )
  await appendFile('index.js', 'var test = {};', cwd)
  await execGit(['add', 'index.js'])

  try {
    await run({ cwd, reporter })
  } catch (error) {
    is(!!error, true)
  }
})

test('run cmd error', async () => {
  let reporter = createReporter({ stream: stdout })

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
  await appendFile('index.js', 'as sadsad', cwd)
  await execGit(['add', 'index.js'])

  try {
    await run({ cwd, reporter })
  } catch (error) {
    is(!!error.tasks, true)
  }
})

test.run()
