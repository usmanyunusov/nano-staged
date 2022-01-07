import { resolve } from 'path'
import c from 'picocolors'

import { loadConfig, readConfig, validConfig } from './config.js'
import { createReporter } from './create-reporter.js'
import { prepareFiles } from './prepare-files.js'
import { pipeliner } from './pipeliner.js'
import { showVersion } from './utils.js'
import { gitWorker } from './git.js'

export default async function runner({
  stream = process.stderr,
  cwd = process.cwd(),
  allowEmpty = false,
  unstaged = false,
  configPath = null,
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

    let config = configPath ? await readConfig(resolve(configPath)) : await loadConfig(cwd)
    if (!config) {
      if (configPath) {
        info(`Nano Staged config file ${c.yellow(configPath)} is not found`)
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

    let entries = unstaged
      ? await git.unstagedFiles({ cwd: repoPath })
      : await git.stagedFiles({ cwd: repoPath })
    if (!entries.length) {
      info(`Git ${unstaged ? 'unstaging' : 'staging'} area is empty.`)
      return
    }

    let files = await prepareFiles({ entries, config, repoPath, cwd })
    if (!files.resolvedTasks.every(({ files }) => files.length > 0)) {
      info(`No files match any configured task.`)
      return
    }

    await pipeliner({ files, repoPath, dotGitPath, stream, unstaged, allowEmpty }).run()
  } catch (err) {
    if (err.tasks) {
      log('\n' + err.tasks)
    } else {
      log('\n' + c.red(err.stack || err.message || err))
    }

    throw err
  }
}
