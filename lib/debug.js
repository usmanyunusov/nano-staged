import util from 'util'
import c from './colors.js'

export function create_debug(name) {
  return !create_debug.enabled
    ? () => {}
    : (...args) => {
        args[0] = c.inverse(c.bold(c.blue(` ${name.toUpperCase()} `))) + ' ' + args[0]
        return process.stderr.write(util.format(...args) + '\n')
      }
}
