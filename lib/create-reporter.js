import c from 'picocolors'

export function createReporter({ stream = process.stderr }) {
  let reporter = {
    log(msg) {
      stream.write(`${msg}\n`)
    },

    info(msg) {
      reporter.log(`${c.cyan(`-`)} ${msg}`)
    },

    step(msg) {
      msg += '...'
      reporter.log(`${c.green(c.bold('-'))} ${msg}`)
    },
  }

  return reporter
}
