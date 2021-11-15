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
  let git = gitWorker({ cwd })
  await git.exec(args, { cwd })
}

test.after.each(async () => {
  stdout.out = ''
})

test('run: didn’t find git directory', async () => {
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Create Nano Staged config in package.json\n'
  )
})

test('run: config in package.json', async () => {
  await makeDir()
  await execGit(['init'])
  await run({ cwd }, reporter({ stream: stdout }))

  equal(
    stdout.out,
    'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Create Nano Staged config in package.json\n'
  )
  await fs.rm(cwd, { recursive: true })
})

test('run: config invalid', async () => {
  await makeDir()
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
  await fs.rm(cwd, { recursive: true })
})

test('run: git staging area is empty', async () => {
  await makeDir()
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
  await fs.rm(cwd, { recursive: true })
})

test('run: no staged files match any configured task', async () => {
  await makeDir()
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n')
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
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
  await fs.rm(cwd, { recursive: true })
})

test.run()
