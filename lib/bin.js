#!/usr/bin/env node

import nanoStaged from './index.js'
import * as utils from './utils.js'

const FORCE_COLOR_LEVEL = utils.getForceColorLevel()

if (FORCE_COLOR_LEVEL) {
  process.env.FORCE_COLOR = FORCE_COLOR_LEVEL.toString()
}

process.on('SIGINT', () => {})

function run() {
  let options = {}

  for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i]

    if (arg === '-c' || arg === '--config') {
      options.config = process.argv[++i]
    } else if (arg === '-u' || arg === '--unstaged') {
      options.unstaged = true
    } else if (arg === '--allow-empty') {
      options.allowEmpty = true
    } else if (arg === '--diff') {
      options.diff = []
    } else if (options.diff && options.diff.length !== 2) {
      options.diff.push(process.argv[i])
    }
  }

  return nanoStaged(options)
}

run().catch(() => {
  process.exitCode = 1
})
