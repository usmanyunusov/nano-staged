import { spawn } from '../../utils/index.js'
import normalizePath from 'normalize-path'
import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'
import fs from 'fs-extra'
import path from 'path'

let tmpDir, cwd, before

async function makeDir() {
  let currentDir = path.dirname(fileURLToPath(import.meta.url))
  let dirname = path.resolve(currentDir, `nano-staged-${nanoid()}`)

  await fs.ensureDir(dirname)
  return dirname
}

async function appendFile(filename, content, dir = cwd) {
  fs.appendFile(path.resolve(dir, filename), content)
}

async function execGit(args) {
  try {
    return await spawn('git', args, { cwd })
  } catch (err) {
    throw err
  }
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
  await spawn('yarn', ['add', path.resolve(cwd, '../../../')], {
    cwd,
  })
  await appendFile('index.js', 'var test = {};')
  await appendFile('index.css', 'body {color: red;}')
  await appendFile('bootstrap.css', 'body {color: red;}')
}

tmpDir = await makeDir()
cwd = normalizePath(tmpDir)

await initGitRepo()
await initProject()

function showTime(name) {
  let prefix = name === 'nano-staged' ? '+ ' : '  '
  let after = performance.now()
  let time = (Math.round(after - before) / 1000)
    .toString()
    .replace(/\.\d$/, '$&00')
    .replace(/\.\d\d$/, '$&0')
  process.stdout.write(prefix + name + '\x1B[1m' + time.padStart(6) + '\x1B[22m ms\n')
}

// Running time for index.js
process.stdout.write('Running time for index.js\n')
await execGit(['add', 'index.js'])

before = performance.now()
await spawn('npx', ['lint-staged'], { cwd })
showTime('lint-staged')

before = performance.now()
await spawn('npx', ['nano-staged'], { cwd })
showTime('nano-staged')

// Running time for index.js, index.css, bootstrap.css
process.stdout.write('Running time for index.js, index.css, bootstrap.css\n')
await execGit(['add', 'index.css', 'bootstrap.css'])

before = performance.now()
await spawn('npx', ['lint-staged'], { cwd })
showTime('lint-staged')

before = performance.now()
await spawn('npx', ['nano-staged'], { cwd })
showTime('nano-staged')

// Remove dir
await fs.remove(tmpDir)
