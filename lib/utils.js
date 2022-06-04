import process from 'process'
import tty from 'tty'
import os from 'os'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function to_array(val) {
  return Array.isArray(val) ? val : [val]
}

export function* split_in_chunks(array, max_chunk_len) {
  let cur = []
  let len = 0

  for (const value of array) {
    let new_len = len + value.length

    if (new_len > max_chunk_len && cur.length > 0) {
      yield cur
      cur = []
      new_len = value.length
    }

    cur.push(value)
    len = new_len
  }

  if (cur.length > 0) {
    yield cur
  }
}

export function str_argv_to_array(str = '') {
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

export function get_force_color_level() {
  const { FORCE_NO_COLOR, NO_COLOR, TERM, COLORTERM, FORCE_COLOR } = process.env

  const has_flags = ['no-color', 'no-colors', 'color=false', 'color=never']
    .reduce((acc, flag) => [...acc, '-' + flag, '--' + flag], [])
    .some((flag) => process.argv.includes(flag))

  if (FORCE_COLOR) {
    return Math.min(Number.parseInt(FORCE_COLOR, 10), 3)
  } else if (has_flags || FORCE_NO_COLOR || NO_COLOR || !tty.isatty(1) || TERM === 'dumb') {
    return 0
  } else if (process.platform === 'win32') {
    const os_release = os.release().split('.')
    if (Number(os_release[0]) >= 10 && Number(os_release[2]) >= 10_586) {
      return Number(os_release[2]) >= 14_931 ? 3 : 2
    }
    return 1
  } else if (/-256(color)?$/i.test(TERM)) {
    return 2
  } else if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(TERM)) {
    return 1
  } else if (COLORTERM) {
    return COLORTERM === 'truecolor' ? 3 : 1
  } else {
    return 0
  }
}
