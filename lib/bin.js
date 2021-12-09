#!/usr/bin/env node

import runner from './run.js'
import { getForceColorLevel } from './utils.js'

let FORCE_COLOR_LEVEL = getForceColorLevel()
if (FORCE_COLOR_LEVEL) {
  process.env.FORCE_COLOR = FORCE_COLOR_LEVEL.toString()
}

// Do not terminate main process on SIGINT
process.on('SIGINT', () => {})

function run() {
  let options = {}

  for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i]

    if (arg === '-c' || arg === '--config') {
      options.configPath = process.argv[++i]
    } else if (arg === '-u' || arg === '--unstaged') {
      options.unstaged = true
    } else if (arg === '--allow-empty') {
      options.allowEmpty = true
    }
  }

  return runner(options)
}

run().catch(() => {
  process.exitCode = 1
})
