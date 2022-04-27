import { get_force_color_level } from './utils.js'

const enabled = get_force_color_level() > 0

const format = (start, end) => (input) => {
  let open = `\x1b[${start}m`
  let close = `\x1b[${end}m`
  let string = '' + input
  let regex = new RegExp(`\\x1b\\[${end}m`, 'g')

  return enabled ? open + string.replace(regex, open) + close : String(string)
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
