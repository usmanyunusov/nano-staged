import { dirname, resolve } from 'path'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { test } from 'uvu'

import run from './index.js'
import { reporter } from '../reporter/index.js'
import { gitWorker } from '../git/index.js'

let stdout = { out: '' }
stdout.write = (symbols) => {
  stdout.out += symbols
}

const DIRNAME = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return resolve(DIRNAME, '../test/fixtures', name)
}

let cwd = fixture('run/run-test')

async function appendFile(filename, content, dir = cwd) {
  await fs.appendFile(resolve(dir, filename), content)
}

async function makeDir(dir = cwd) {
  await fs.mkdir(dir)
}

async function writeFile(filename, content, dir = cwd) {
  await fs.writeFile(resolve(dir, filename), content)
}

async function execGit(args) {
  let git = gitWorker(cwd)
  await git.exec(args, { cwd })
}

test.before.each(async () => {
  await makeDir()
})

test.after.each(async () => {
  stdout.out = ''
  await fs.rm(cwd, { recursive: true })
})

async function gitInit() {
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n')
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
}

test('run: didn’t find git directory', async () => {
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Create Nano Staged config in package.json\n'
  )
})

test('run: config in package.json', async () => {
  await execGit(['init'])
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Create Nano Staged config in package.json\n'
  )
})

test('run: config invalid', async () => {
  await execGit(['init'])
  await appendFile(
    'package.json',
    `{
        "nano-staged": {}
    }`
  )
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' + '\x1B[36m-\x1B[39m Nano Staged config invalid\n'
  )
})

test('run: git staging area is empty', async () => {
  await execGit(['init'])
  await appendFile(
    'package.json',
    `{
      "nano-staged": {
        "*.js": "prettier --write"
      }
    }`
  )
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n\x1B[36m-\x1B[39m Git staging area is empty.\n'
  )
})

test('run: no staged files match any configured task', async () => {
  await gitInit()
  await writeFile('README.md', '# Test\n## Test')
  await execGit(['add', 'README.md'])
  await appendFile(
    'package.json',
    `{
        "nano-staged": {
          "*.js": "prettier --write"
        }
      }`
  )
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m No staged files match any configured task.\n'
  )
})

test('run: pipeline start', async () => {
  await gitInit()
  await writeFile('index.js', 'let a = {};')
  await execGit(['add', 'index.js'])
  await appendFile(
    'package.json',
    `{
        "nano-staged": {
          "*.js": "prettier --write"
        }
      }`
  )
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
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

test('run: pipeline task command fail', async () => {
  await gitInit()
  await writeFile('index.js', 'let a = {};')
  await execGit(['add', 'index.js'])
  await appendFile(
    'package.json',
    `{
        "nano-staged": {
          "*.js": "prsettier --write"
        }
      }`
  )
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Preparing pipeliner...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done backing up original repo state.\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Running tasks...\n' +
      '  \x1B[1m\x1B[31m*.js\x1B[39m\x1B[22m prsettier --write\n' +
      '\x1B[32m-\x1B[39m Restoring original state...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done restoring\x1B[22m\n' +
      '\x1B[32m-\x1B[39m Removing patch file...\n' +
      '\x1B[2m  \x1B[32m»\x1B[39m Done clearing cache and removing patch file\x1B[22m\n' +
      '\n' +
      '\x1B[31mprsettier --write:\n' +
      '\x1B[39mError: spawn prsettier ENOENT\n'
  )
})

test.run()
