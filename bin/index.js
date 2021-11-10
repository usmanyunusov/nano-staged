#!/usr/bin/env node

import { createGitSpawn } from '../git/index.js'
import { loadConfig, validConfig } from '../config/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { createPipeliner } from '../pipeliner/index.js'
import { createReporter } from '../reporter/index.js'
import { getVersion } from '../utils/index.js'
import pico from 'picocolors'

let reporter = createReporter({ stream: process.stderr })

async function run() {
  let cwd = process.cwd()
  let version = await getVersion(cwd)
  reporter.log(pico.bold(`Nano Staged v${version}`))

  let git = createGitSpawn({ cwd })
  let { gitDir, gitConfigDir } = await git.resolveDir(cwd)
  if (!gitDir) {
    reporter.info('Nano Staged didn’t find git directory')
    return
  }

  let config = await loadConfig(cwd)
  if (!config) {
    reporter.info(`Create Nano Staged config in package.json`)
    return
  }

  let isValid = validConfig(config)
  if (!isValid) {
    reporter.info(`Nano Staged config invalid`)
    return
  }

  let stagedFiles = await git.getStagedFiles({ gitDir, cwd })
  if (!stagedFiles.length) {
    reporter.info(`Git staging area is empty.`)
    return
  }

  let files = prepareFiles(stagedFiles, config)
  if (files.tasks.every((subTasks) => subTasks.every((task) => !task.files.length))) {
    reporter.info(`No staged files match any configured task.`)
    return
  }

  return createPipeliner({ process, files, gitConfigDir, gitDir }).run()
}

run()
  .then(() => {})
  .catch((err) => {
    if (err.own) {
      reporter.error(err.message)
    } else if (err.stack) {
      reporter.error(err.stack)
    } else {
      reporter.error(err)
    }

    process.exit(1)
  })
