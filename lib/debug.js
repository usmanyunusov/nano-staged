import * as util from 'util'
import c from './colors.js'

export const create_debug =
  (name) =>
  (...args) => {
    if ('NS_DEBUG' in process.env) {
      args[0] = c.inverse(c.bold(c.green(` ${name.toUpperCase()} `))) + ' ' + args[0]
      process.stderr.write(util.format(...args) + '\n')
    }
  }
