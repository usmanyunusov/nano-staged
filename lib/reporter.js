import c from 'picocolors'

import { NanoStagedError, TaskRunnerError } from './errors.js'

export function createReporter(stream = process.stderr) {
  function print(lines) {
    stream.write(lines)
  }

  const reporter = {
    error(err) {
      if (err instanceof NanoStagedError) {
        const msg = err.message.replace(/\*([^*]+)\*/g, c.yellow('$1'))

        if (['noFiles', 'noMatchingFiles'].includes(err.type)) {
          print(`${c.cyan(`-`)} ${msg}\n`)
        } else {
          print(`${c.red('×')} ${c.red(msg)}\n`)
        }
      } else if (err instanceof TaskRunnerError) {
        print(`\n${err.message || err}\n`)
      } else {
        print(`\n${c.red(err.message || err)}\n`)
      }
    },
  }

  return reporter
}
