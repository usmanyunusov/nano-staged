import { resolve } from 'path'
import pico from 'picocolors'

import { loadConfig, readConfig, validConfig } from './config.js'
import { createReporter } from './create-reporter.js'
import { prepareFiles } from './prepare-files.js'
import { pipeliner } from './pipeliner.js'
import { showVersion } from './utils.js'
import { gitWorker } from './git.js'

export default async function run({
  configPath,
  cwd = process.cwd(),
  stream = process.stderr,
} = {}) {
  let { log, info } = createReporter({ stream })

  showVersion(log)

  try {
    let git = gitWorker(cwd)

    let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()
    if (!repoPath) {
      info('Nano Staged didn’t find git directory')
      return
    }

    let config = configPath ? readConfig(resolve(configPath)) : loadConfig(cwd)
    if (!config) {
      if (configPath) {
        info(`Nano Staged config file ${pico.yellow(configPath)} is not found`)
      } else {
        info(`Create Nano Staged config in package.json`)
      }

      return
    }

    let isValid = validConfig(config)
    if (!isValid) {
      info(`Nano Staged config invalid`)
      return
    }

    let entries = await git.getStagedFiles({ cwd: repoPath })
    if (!entries.length) {
      info(`Git staging area is empty.`)
      return
    }

    let files = prepareFiles({ entries, config, repoPath, cwd })
    if (!files.taskedFiles.length) {
      info(`No staged files match any configured task.`)
      return
    }

    await pipeliner({ repoPath, files, dotGitPath, stream, config }).run()
  } catch (err) {
    if (err.tasks) {
      log('\n' + err.tasks)
    } else {
      /* c8 ignore next 2 */
      log('\n' + pico.red(err.stack || err.message || err))
    }

    throw err
  }
}
