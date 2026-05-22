#!/usr/bin/env node

import nanoStaged from './index.js'
import * as utils from './utils.js'

const FORCE_COLOR_LEVEL = utils.getForceColorLevel()

if (FORCE_COLOR_LEVEL) {
  process.env.FORCE_COLOR = FORCE_COLOR_LEVEL.toString()
}

process.on('SIGINT', () => {})

function showHelp() {
  process.stdout.write(
    `Usage: nano-staged [options]

Options:
  -c, --config <path>  Path to config file
  -u, --unstaged       Run on unstaged changes
  --allow-empty        Allow empty commits
  --fail-on-changes    Fail with exit code 1 when tasks modify tracked files
  --diff <a> <b>       Run on diff between two revisions
  --quiet              Suppress output
  --bail               Exit on first error
  -v, --version        Show version
  -h, --help           Show this help
`,
  )
}

function run() {
  let options = {}

  for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i]

    if (arg === '-v' || arg === '--version') {
      utils.showVersion(process.stdout)
      return
    } else if (arg === '-h' || arg === '--help') {
      showHelp()
      return
    } else if (arg === '-c' || arg === '--config') {
      options.config = process.argv[++i]
    } else if (arg === '-u' || arg === '--unstaged') {
      options.unstaged = true
    } else if (arg === '--allow-empty') {
      options.allowEmpty = true
    } else if (arg === '--fail-on-changes') {
      options.failOnChanges = true
    } else if (arg === '--diff') {
      options.diff = []
    } else if (arg === '--quiet') {
      options.quiet = true
    } else if (arg === '--bail') {
      if (typeof AbortController === 'undefined') {
        process.stderr.write('nano-staged: --bail is not supported in this version of Node.js\n')
        process.exit(1)
      }
      options.bail = true
    } else if (options.diff && options.diff.length !== 2) {
      options.diff.push(process.argv[i])
    }
  }

  return nanoStaged(options)
}

let result = run()
if (result) {
  result.catch(() => {
    process.exitCode = 1
  })
}
