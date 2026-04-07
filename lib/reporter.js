import { styleText } from 'util'

import { NanoStagedError, TaskRunnerError } from './errors.js'

export function createReporter(stream = process.stderr) {
  function print(lines) {
    stream.write(lines)
  }

  const reporter = {
    error(err) {
      if (err instanceof NanoStagedError) {
        const msg = err.message.replace(/\*([^*]+)\*/g, styleText('yellow', '$1'))

        if (['noFiles', 'noMatchingFiles'].includes(err.type)) {
          print(`${styleText('cyan', `-`)} ${msg}\n`)
        } else {
          print(`${styleText('red', '×')} ${styleText('red', msg)}\n`)
        }
      } else if (err instanceof TaskRunnerError) {
        print(`\n${err.message || err}\n`)
      } else {
        print(`\n${styleText('red', err.message || err)}\n`)
      }
    },
  }

  return reporter
}
