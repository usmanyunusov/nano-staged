import { execFile } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { promisify } from 'util'
import { nanoid } from 'nanoid'
import fs from 'fs-extra'

import { gitWorker } from '../../git/index.js'

let spawn = promisify(execFile)
let currentDir = dirname(fileURLToPath(import.meta.url))
let cwd = resolve(currentDir, `nano-staged-${nanoid()}`)
let files = [['index.js'], ['index.js', 'index.css', 'bootstrap.css']]
let runners = ['lint-staged', 'nano-staged']
let before

async function makeDir(dir = cwd) {
  await fs.mkdir(dir)
}

async function appendFile(filename, content, dir = cwd) {
  await fs.appendFile(resolve(dir, filename), content)
}

async function execGit(args) {
  let git = gitWorker(cwd)
  await git.exec(args, { cwd })
}

async function initGitRepo() {
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n')
  await appendFile('.gitignore', `node_modules/\n`)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
}

async function initProject() {
  await appendFile(
    'package.json',
    `{
      "lint-staged": {
        "*.js": "prettier --write",
        "*.css": ["prettier --write", "prettier --write"]
      },
      "nano-staged": {
        "*.js": "prettier --write",
        "*.css": ["prettier --write", "prettier --write"]
      }
    }`
  )

  await spawn('yarn', ['add', 'lint-staged'], { cwd })
  await spawn('yarn', ['add', resolve(cwd, '../../../')], {
    cwd,
  })
  await appendFile('index.js', 'var test = {};')
  await appendFile('index.css', 'body {color: red;}')
  await appendFile('bootstrap.css', 'body {color: red;}')
}

function showTime(name) {
  let prefix = name === 'nano-staged' ? '+ ' : '- '
  let after = performance.now()
  let time = (Math.round(after - before) / 1000)
    .toString()
    .replace(/\.\d$/, '$&00')
    .replace(/\.\d\d$/, '$&0')
  process.stdout.write(prefix + name + '\x1B[1m' + time.padStart(6) + '\x1B[22m ms\n')
}

await makeDir()
await initGitRepo()
await initProject()

async function run(names = [], files = []) {
  await execGit(['add', ...files])

  for (let name of names) {
    before = performance.now()
    await spawn('npx', [name], { cwd })
    showTime(name)
  }

  await execGit(['checkout', ...files])
}

for (let i = 0; i < runners.length; i++) {
  await run(runners, files[i])
}

await fs.remove(cwd)
