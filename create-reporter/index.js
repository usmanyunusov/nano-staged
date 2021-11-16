import pico from 'picocolors'

export function createReporter({ stream }) {
  let reporter = {
    log(msg) {
      stream.write(`${msg}\n`)
    },

    info(msg) {
      reporter.log(`${pico.cyan(`-`)} ${msg}`)
    },

    step(msg) {
      msg += '...'
      reporter.log(`${pico.green(`-`)} ${msg}`)
    },
  }

  return reporter
}
