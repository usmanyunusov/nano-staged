#!/usr/bin/env node

import { is_color_supported } from './colors.js'
import { create_debug } from './debug.js'
import nano_staged from './index.js'

if (is_color_supported) {
  process.env.FORCE_COLOR = '1'
}

process.on('SIGINT', () => {})

function run() {
  let options = {}
  let args = process.argv.reduce((acc, arg) => [...acc, ...arg.split('=')], [])

  for (let i = 2; i < args.length; i++) {
    let arg = args[i]

    if (arg === '-c' || arg === '--config') {
      options.config = args[++i]
    } else if (arg === '--max-arg-length') {
      options.max_arg_length = Number(args[++i])
    } else if (arg === '--debug') {
      create_debug.enabled = true
    } else if (arg === '--allow-empty') {
      options.allow_empty = true
    } else if (arg === '--diff-filter') {
      options.diff_filter = args[++i]
    } else if (arg === '--diff') {
      options.diff = []
    } else if (options.diff && options.diff.length !== 2) {
      options.diff.push(args[i])
    }
  }

  const debug = create_debug('nano-staged:bin')
  debug('Options parsed from CLI:', options)
  debug('FORCE_COLOR_LEVEL:', process.env.FORCE_COLOR)

  return nano_staged(options)
}

run().catch(() => {
  process.exitCode = 1
})
