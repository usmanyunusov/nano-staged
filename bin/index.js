#!/usr/bin/env node

import run from '../run/index.js'

// Do not terminate main process on SIGINT
process.on('SIGINT', () => {})

let options = {}

run(options).catch(() => {
  process.exitCode = 1
})
