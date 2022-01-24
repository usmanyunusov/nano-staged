import { getConfig, validConfig } from './config.js'
import { createReporter } from './create-reporter.js'
import { NanoStagedError } from './error.js'
import { createRunner } from './runner.js'
import { showVersion } from './utils.js'

export default async function nanoStaged({
  config: conf = undefined,
  stream = process.stderr,
  cwd = process.cwd(),
  allowEmpty = false,
  unstaged = false,
  diff = false,
} = {}) {
  let reporter = createReporter({ stream })

  showVersion(stream)

  try {
    let config = await getConfig(cwd, conf)
    if (!config) {
      if (typeof conf === 'string') {
        throw new NanoStagedError('noFileConfig', conf)
      } else {
        throw new NanoStagedError('noConfig')
      }
    }

    if (!validConfig(config)) {
      throw new NanoStagedError('invalidConfig')
    }

    const runner = await createRunner({ config, stream, cwd, allowEmpty })

    if (unstaged) {
      await runner.run('unstaged')
    } else if (diff && Array.isArray(diff)) {
      await runner.run('diff', { refs: diff })
    } else {
      await runner.run('staged')
    }
  } catch (err) {
    reporter.error(err)
    throw err
  }
}
