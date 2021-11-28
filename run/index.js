import { resolve } from 'path'
import pico from 'picocolors'

import { loadConfig, readConfig, validConfig } from '../config/index.js'
import { createReporter } from '../create-reporter/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { pipeliner } from '../pipeliner/index.js'
import { showVersion } from '../utils/index.js'
import { gitWorker } from '../git/index.js'

export default async function run({
  configPath,
  unstaged = false,
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

    let entries = unstaged
      ? await git.unstagedFiles({ cwd: repoPath })
      : await git.stagedFiles({ cwd: repoPath })
    if (!entries.length) {
      info(`Git staging area is empty.`)
      return
    }

    let files = prepareFiles({ entries, config, repoPath, cwd })
    if (!files.taskedFiles.length) {
      info(`No files match any configured task.`)
      return
    }

    await pipeliner({ repoPath, files, dotGitPath, stream, config, unstaged }).run()
  } catch (err) {
    if (err.tasks) {
      log('\n' + err.tasks)
    } else {
      log('\n' + pico.red(err.stack || err.message || err))
    }

    throw err
  }
}
