import pico from 'picocolors'

export function reporter({ stream }) {
  let report = {
    log(msg) {
      stream.write(`${msg}\n`)
    },

    info(msg) {
      report.log(`${pico.cyan(`-`)} ${msg}`)
    },

    error(msg) {
      report.log(pico.red(msg))
    },

    step(msg) {
      msg += '...'
      report.log(`${pico.green(`-`)} ${msg}`)
    },
  }

  return report
}
