import c from 'picocolors'

export function createReporter({ stream = process.stderr }) {
  function print(lines) {
    stream.write(lines)
  }

  function error(msg) {
    print(`${c.bold(c.red('×'))} ${msg}\n`)
  }

  function succes(msg) {
    print(`${c.bold(c.green('√'))} ${msg}\n`)
  }

  function warning(msg) {
    print(`${c.bold(c.cyan(`-`))} ${msg}\n`)
  }

  let reporter = {
    step(msg, err) {
      msg += '...'

      if (err) {
        error(`${msg}\n${c.red(err.message || err)}`)
      } else {
        succes(msg)
      }
    },

    error(err) {
      if (err.name === 'NanoStagedError') {
        if (['noFiles', 'noMatchingFiles'].includes(err.type)) {
          warning(err.message || err)
        } else {
          let msg = err.message
            .split('. ')
            .map((i) => i.replace(/\*([^*]+)\*/g, c.yellow('$1')))
            .join('.\n        ')
          error(c.red(msg))
        }
      } else if (err.name === 'TaskRunnerError') {
        print(`\n${err.message || err}\n`)
      } else {
        error(c.red(err.message || err))
      }
    },
  }

  return reporter
}
