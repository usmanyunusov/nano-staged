#!/usr/bin/env node

import runner from '../run/index.js'

// Do not terminate main process on SIGINT
process.on('SIGINT', () => {})

function run() {
  let options = {}

  for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i]

    if (arg === '-c' || arg === '--config') {
      options.configPath = process.argv[i + 1]
    } else if (arg === '--not-staged') {
      options.notStaged = true
    }
  }

  return runner(options)
}

run().catch(() => {
  process.exitCode = 1
})
