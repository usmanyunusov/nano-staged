import pico from 'picocolors'

export function createReporter({ stream }) {
  return {
    log(msg) {
      stream.write(`${msg}\n`)
    },

    info(msg) {
      this.log(`${pico.cyan(`-`)} ${msg}`)
    },

    error(msg) {
      this.log(pico.red(msg))
    },

    step(msg) {
      msg += '...'
      this.log(`${pico.green(`-`)} ${msg}`)
    },
  }
}
