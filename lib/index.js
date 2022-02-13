import { createReporter } from './create-reporter.js'
import { getConfig, validConfig } from './config.js'
import { NanoStagedError } from './error.js'
import { createRunner } from './runner.js'

const defaultOptions = {
  config: undefined,
  stream: process.stderr,
  cwd: process.cwd(),
  allowEmpty: false,
  diff: false,
  unstaged: false,
}

export default async function (opts = { ...defaultOptions, ...opts }) {
  const report = createReporter(opts.stream)

  try {
    const config = await getConfig(opts.cwd, opts.config)

    if (!config) {
      if (typeof opts.config === 'string') {
        throw new NanoStagedError('noFileConfig', opts.config)
      } else {
        throw new NanoStagedError('noConfig')
      }
    }

    if (!validConfig(config)) {
      throw new NanoStagedError('invalidConfig')
    }

    const runner = createRunner({ ...opts, config })

    if (opts.unstaged) {
      await runner.run('unstaged')
    } else if (opts.diff && Array.isArray(opts.diff)) {
      await runner.run('diff', { refs: opts.diff })
    } else {
      await runner.run()
    }
  } catch (error) {
    const errors = Array.isArray(error) ? error : [error]

    for (const error of errors) {
      report.error(error)
    }

    throw error
  }
}
