import c from 'picocolors'

export function createReporter({ stream = process.stderr }) {
  let reporter = {
    step(msg, err) {
      msg += '...'

      if (err) {
        stream.write(`${c.red(c.bold('×'))} ${msg}\n${c.red(err.message || err)}\n`)
      } else {
        stream.write(`${c.green(c.bold('√'))} ${msg}\n`)
      }
    },

    error(err) {
      if (err.name === 'NanoStagedError') {
        if (['noFiles', 'noMatchingFiles'].includes(err.type)) {
          stream.write(`${c.cyan(`-`)} ${err.message || err}\n`)
        } else {
          let msg = err.message
            .split('. ')
            .map((i) => i.replace(/\*([^*]+)\*/g, c.yellow('$1')))
            .join('.\n        ')
          stream.write(`${c.bgRed(c.black(' ERROR '))} ${c.red(msg)}\n`)
        }
      } else if (err.name === 'TaskRunnerError') {
        stream.write(`\n${err.message || err}\n`)
      } else {
        stream.write(`${c.bgRed(c.black(' ERROR '))} ${c.red(err.message || err)}\n`)
      }
    },
  }

  return reporter
}
