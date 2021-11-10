#!/usr/bin/env node

import { getGitDir, gitGetStagedFiles } from '../git/index.js'
import { loadConfig, validConfig } from '../config/index.js'
import { getVersion } from '../utils/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { createPipeliner } from '../pipeliner/index.js'
import { createReporter } from '../reporter/index.js'
import pico from 'picocolors'

let reporter = createReporter({ stream: process.stderr })

async function run() {
  let version = await getVersion(process.cwd())
  reporter.log(pico.bold(`Nano Staged v${version}`))

  let gitDir = await getGitDir(process.cwd())
  if (!gitDir) {
    reporter.info('Nano Staged didn’t find git directory\n')
    return
  }

  let config = await loadConfig(process.cwd())
  if (!config) {
    reporter.info(`Create Nano Staged config in package.json\n`)
    return
  }

  let isValid = validConfig(config)
  if (!isValid) {
    reporter.info(`Nano Staged config invalid\n`)
    return
  }

  let stagedFiles = await gitGetStagedFiles({ gitDir, cwd: process.cwd() })
  if (!stagedFiles.length) {
    reporter.info(`Git staging area is empty.\n`)
    return
  }

  let files = prepareFiles(stagedFiles, config)
  if (files.tasks.every((subTasks) => subTasks.every((task) => !task.files.length))) {
    reporter.info(`No staged files match any configured task.\n`)
    return
  }

  return createPipeliner({ process, files }).run()
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
