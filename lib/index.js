import c from 'picocolors'

import { createGitPipeliner } from './git-pipeliner.js'
import { loadConfig, validConfig } from './config.js'
import { createReporter } from './create-reporter.js'
import { showVersion } from './utils.js'

export default async function nanoStaged({
  stream = process.stderr,
  cwd = process.cwd(),
  allowEmpty = false,
  unstaged = false,
  config: inputConfig = undefined,
} = {}) {
  let { log, info } = createReporter({ stream })

  showVersion(log)

  try {
    let config = await loadConfig(cwd, inputConfig)
    if (!config) {
      if (typeof inputConfig === 'string') {
        info(`Nano Staged config file ${c.yellow(inputConfig)} is not found.`)
      } else {
        info(`Create Nano Staged config.`)
      }

      return
    }

    let isValid = validConfig(config)
    if (!isValid) {
      info(`Nano Staged config invalid`)
      return
    }

    switch (true) {
      default: {
        let pl = await createGitPipeliner({
          allowEmpty,
          config,
          stream,
          cwd,
        })

        unstaged ? await pl.unstaged() : await pl.staged()
        break
      }
    }
  } catch (err) {
    if (err.tasks) {
      log('\n' + err.tasks)
    } else {
      log('\n' + c.red(err.stack || err.message || err))
    }

    throw err
  }
}
