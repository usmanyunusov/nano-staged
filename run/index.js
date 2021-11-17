import pico from 'picocolors'

import { loadConfig, validConfig } from '../config/index.js'
import { createReporter } from '../create-reporter/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { pipeliner } from '../pipeliner/index.js'
import { showVersion } from '../utils/index.js'
import { gitWorker } from '../git/index.js'

export default async function run({ cwd = process.cwd(), reporter } = {}) {
  let { log, info } = reporter || createReporter({ stream: process.stderr })
  let git = gitWorker(cwd)

  showVersion(log)

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()
  if (!repoPath) {
    info('Nano Staged didn’t find git directory')
    return
  }

  let config = await loadConfig(cwd)
  if (!config) {
    info(`Create Nano Staged config in package.json`)
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
  if (files.allTasks.every((subTasks) => subTasks.every((task) => !task.files.length))) {
    info(`No staged files match any configured task.`)
    return
  }

  try {
    await pipeliner({ cwd: repoPath, files, dotGitPath, reporter }).run()
  } catch (err) {
    if (err.tasks) {
      log('\n' + err.tasks)
    } else {
      log('\n' + pico.red(err))
    }

    throw err
  }
}
