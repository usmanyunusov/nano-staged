#!/usr/bin/env node

import { is_color_support } from './colors.js'
import { create_debug } from './debug.js'
import nano_staged from './index.js'

if (is_color_support) {
  process.env.FORCE_COLOR = '1'
}

process.on('SIGINT', () => {})

const debug = create_debug('nano-staged:bin')

function run() {
  const args = process.argv.reduce((prev, arg) => [...prev, ...arg.split('=')], [])
  const opts = {}

  for (let i = 2; i < args.length; i++) {
    let arg = args[i]

    if (arg === '-u' || arg === '--unstaged') {
      opts.unstaged = true
    } else if (arg === '-d' || arg === '--debug') {
      process.env.NS_DEBUG = true
    } else if (arg === '--allow-empty') {
      opts.allow_empty = true
    } else if (arg === '--shell') {
      opts.shell = true
    } else if (arg === '--cwd') {
      opts.unstaged = args[++i]
    } else if (arg === '-c' || arg === '--config') {
      opts.config_path = args[++i]
    } else if (arg === '--max-arg-length') {
      opts.max_arg_length = Number(args[++i])
    } else if (arg === '--diff-filter') {
      opts.diff_filter = args[++i]
    } else if (arg === '--diff') {
      opts.diff = []
    } else if (opts.diff && opts.diff.length !== 2) {
      opts.diff.push(args[i])
    }
  }

  debug('Options parsed from CLI:', opts)
  debug('FORCE_COLOR:', process.env.FORCE_COLOR)

  return nano_staged(opts)
}

run().catch(() => {
  process.exitCode = 1
})
