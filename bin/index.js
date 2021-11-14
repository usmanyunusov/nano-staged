#!/usr/bin/env node

import run from '../run/index.js'

// Do not terminate main process on SIGINT
process.on('SIGINT', () => {})

run().catch(() => {
  process.exitCode = 1
})
