import c from 'picocolors'

import { loadConfig, validConfig } from './config.js'
import { createReporter } from './create-reporter.js'
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
  let { log, info } = createReporter({ stream })

  try {
    showVersion(log)

    let config = await loadConfig(cwd, conf)
    if (!config) {
      if (typeof conf === 'string') {
        info(`Nano Staged config file ${c.yellow(conf)} is not found.`)
      } else {
        info(`Create Nano Staged config.`)
      }

      return
    }

    if (!validConfig(config)) {
      info(`Nano Staged config invalid.`)
      return
    }

    const runner = await createRunner(config, stream, cwd, allowEmpty)

    switch (true) {
      case unstaged:
        await runner.run('unstaged')
        break
      case diff && Array.isArray(diff):
        await runner.run('diff', { refs: diff })
        break
      default:
        await runner.run('staged')
        break
    }
  } catch (err) {
    throw err.map((e) => {
      if (e.name === 'TaskError') {
        return log('\n' + e.message || e)
      }

      return log('\n' + c.red(e.message || e))
    })
  }
}
