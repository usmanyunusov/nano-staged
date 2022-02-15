import { getConfig, validConfig } from './config.js'
import { createReporter } from './reporter.js'
import { NanoStagedError } from './errors.js'
import { createRunner } from './runner.js'
import { toArray } from './utils.js'

const defaultOptions = {
  config: undefined,
  stream: process.stderr,
  cwd: process.cwd(),
  allowEmpty: false,
  diff: false,
  unstaged: false,
}

export default async function (opts = { ...defaultOptions, ...opts }) {
  const reporter = createReporter(opts.stream)

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
  } catch (errors) {
    for (const error of toArray(errors)) {
      reporter.error(error)
    }

    throw errors
  }
}
