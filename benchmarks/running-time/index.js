import fs from 'fs-extra'
import path from 'path'
import { git, spawn } from '../../utils/index.js'
import normalize from 'normalize-path'
import { fileURLToPath } from 'url'

let __dirname = path.dirname(fileURLToPath(import.meta.url))
let tmpDir, cwd, before

const createTempDir = async () => {
  const dirname = path.resolve(__dirname, `.nano-staged-test`)
  await fs.ensureDir(dirname)
  return dirname
}

function showTime(name) {
  let after = performance.now()
  process.stdout.write(name + ' ' + parseFloat((after - before) / 1000) + 'ms\n')
}

const appendFile = async (filename, content, dir = cwd) =>
  fs.appendFile(path.resolve(dir, filename), content)

const execGit = async (args) => git(args, { cwd })

const initGitRepo = async () => {
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n')
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
  await appendFile('.gitignore', `node_modules/`)
}

const initYarn = async () => {
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
}

tmpDir = await createTempDir()
cwd = normalize(tmpDir)

await initGitRepo()
await initYarn()

process.stdout.write('Running time for index.js\n')
await appendFile('index.js', 'var test = {};')
await execGit(['add', 'index.js'])

before = performance.now()
await spawn('npx', ['lint-staged'], { cwd })
showTime('lint-staged')

before = performance.now()
await spawn('npx', ['nano-staged'], { cwd })
showTime('nano-staged')

process.stdout.write('Running time for index.js, index.css, bootstrap.css\n')
await appendFile('index.css', 'body {color: red;}')
await appendFile('bootstrap.css', 'body {color: red;}')
await execGit(['add', 'index.css', 'bootstrap.css'])

before = performance.now()
await spawn('npx', ['lint-staged'], { cwd })
showTime('lint-staged')

before = performance.now()
await spawn('npx', ['nano-staged'], { cwd })
showTime('nano-staged')

await fs.remove(tmpDir)
