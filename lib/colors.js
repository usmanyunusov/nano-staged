import * as tty from 'tty'

export const is_color_support =
  !('NO_COLOR' in process.env || process.argv.includes('--no-color')) &&
  ('FORCE_COLOR' in process.env ||
    process.argv.includes('--color') ||
    process.platform === 'win32' ||
    (tty.isatty(1) && process.env.TERM !== 'dumb') ||
    'CI' in process.env)

const format = (start, end) => (input) => {
  const open = `\x1b[${start}m`
  const close = `\x1b[${end}m`
  const string = '' + input
  const regex = new RegExp(`\\x1b\\[${end}m`, 'g')

  return is_color_support ? open + string.replace(regex, open) + close : String(string)
}

export default {
  inverse: format(7, 27),
  yellow: format(93, 39),
  green: format(92, 39),
  cyan: format(96, 39),
  gray: format(90, 39),
  bold: format(1, 22),
  red: format(91, 39),
  dim: format(2, 22),
}
