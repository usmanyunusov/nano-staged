#!/usr/bin/env node

import runner from './run.js'
import { getForceColorLevel } from './utils'

let FORCE_COLOR_LEVEL = getForceColorLevel()
if (FORCE_COLOR_LEVEL) {
  process.env.FORCE_COLOR = FORCE_COLOR_LEVEL.toString()
}

// Do not terminate main process on SIGINT
process.on('SIGINT', () => {})

function run() {
  let options = {}
  let arg = process.argv[2]

  if (arg === '-c' || arg === '--config') {
    options.configPath = process.argv[3]
  }

  return runner(options)
}

run().catch(() => {
  process.exitCode = 1
})
