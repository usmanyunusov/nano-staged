import pico from 'picocolors'

export function createReporter({ stream }) {
  let reporter = {
    print(msg) {
      stream.write(`${msg}`)
    },

    log(msg) {
      reporter.print(`${msg}\n`)
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
