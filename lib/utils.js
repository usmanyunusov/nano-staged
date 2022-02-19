import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import process from 'process'
import { join } from 'path'
import c from 'picocolors'
import tty from 'tty'
import os from 'os'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function toArray(val) {
  return Array.isArray(val) ? val : [val]
}

export function showVersion(print) {
  let pkg = readFileSync(join(fileURLToPath(import.meta.url), '../..', 'package.json'))
  let pkgJson = JSON.parse(pkg.toString())
  print.write(`Nano Staged ${c.bold(`v${pkgJson.version}`)}\n`)
}

export function stringArgvToArray(str = '') {
  let args = []
  let match

  while (true) {
    match = REG_STR.exec(str)

    if (!match) {
      return args
    }

    for (let arg of [match[1], match[6], match[0]]) {
      if (typeof arg === 'string') {
        args.push(arg)
      }
    }
  }
}

function hasFlags(...flags) {
  return flags
    .reduce((acc, flag) => [...acc, '-' + flag, '--' + flag], [])
    .some((flag) => process.argv.includes(flag))
}

export function getForceColorLevel() {
  if (hasFlags('no-color', 'no-colors', 'color=false', 'color=never')) {
    return 0
  } else if (process.env.FORCE_COLOR) {
    return Math.min(Number.parseInt(process.env.FORCE_COLOR, 10), 3)
  } else if (process.env.FORCE_NO_COLOR) {
    return 0
  } else if (!tty.isatty(1)) {
    return 0
  } else if (process.env.TERM === 'dumb') {
    return 0
  } else if (process.platform === 'win32') {
    const osRelease = os.release().split('.')
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10_586) {
      return Number(osRelease[2]) >= 14_931 ? 3 : 2
    }
    return 1
  } else if (process.env.COLORTERM === 'truecolor') {
    return 3
  } else if (/-256(color)?$/i.test(process.env.TERM)) {
    return 2
  } else if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
    return 1
  } else if (process.env.COLORTERM) {
    return 1
  } else {
    return 0
  }
}
