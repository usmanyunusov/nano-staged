#!/usr/bin/env node

import { loadConfig, validConfig } from '../config/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { pipeliner } from '../pipeliner/index.js'
import { reporter } from '../reporter/index.js'
import { getVersion } from '../utils/index.js'
import { gitWorker } from '../git/index.js'
import pico from 'picocolors'

let { log, info } = reporter({ stream: process.stderr })

async function run() {
  let cwd = process.cwd()
  let version = await getVersion(cwd)

  log(pico.bold(`Nano Staged v${version}`))

  let git = gitWorker({ cwd })
  let { gitDir, gitConfigDir } = await git.resolveDir(cwd)
  if (!gitDir) {
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

  let stagedFiles = await git.getStagedFiles({ gitDir, cwd })
  if (!stagedFiles.length) {
    info(`Git staging area is empty.`)
    return
  }

  let files = prepareFiles(stagedFiles, config)
  if (files.tasks.every((subTasks) => subTasks.every((task) => !task.files.length))) {
    info(`No staged files match any configured task.`)
    return
  }

  return pipeliner({ process, files, gitConfigDir, gitDir }).run()
}

run()
  .then(() => {})
  .catch((err) => {
    if (err.cmds) {
      log('\n' + err.cmds)
    } else if (err.own) {
      log('\n' + pico.red(err.message))
    } else if (err.stack) {
      log('\n' + pico.red(err.stack))
    } else {
      log('\n' + pico.red(err))
    }

    process.exit(1)
  })
