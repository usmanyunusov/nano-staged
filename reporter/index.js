import pico from 'picocolors'

export function createReporter({ stream }) {
  return {
    log(msg) {
      stream.write(`${msg}\n`)
    },

    step(msg) {
      msg += '...'
      this.log(`${pico.green(`-`)} ${msg}`)
    },
  }
}
