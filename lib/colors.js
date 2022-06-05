import * as tty from 'tty'

export const is_color_supported =
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

  return is_color_supported ? open + string.replace(regex, open) + close : String(string)
}

export default {
  bg_magenta: format(45, 49),
  inverse: format(7, 27),
  yellow: format(33, 39),
  green: format(32, 39),
  cyan: format(36, 39),
  blue: format(34, 39),
  gray: format(90, 39),
  bold: format(1, 22),
  red: format(31, 39),
  dim: format(2, 22),
}
