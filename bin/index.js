#!/usr/bin/env node

import { getGitDir, gitGetStagedFiles } from '../git/index.js'
import { loadConfig, validConfig } from '../config/index.js'
import { error, info, getVersion } from '../utils/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { createPipeliner } from '../pipeliner/index.js'
import pico from 'picocolors'

async function run() {
  let version = await getVersion(process.cwd())
  info(pico.bold(`Nano Staged ${version}`))

  let gitDir = await getGitDir(process.cwd())
  if (!gitDir) {
    error('Nano Staged didn’t find git directory')
    process.exit(1)
  }

  let config = await loadConfig(process.cwd())
  if (!config) {
    error(`Create Nano Staged config in package.json`)
    process.exit(1)
  }

  let isValid = validConfig(config)
  if (!isValid) {
    error(`Nano Staged config invalid`)
    process.exit(1)
  }

  let stagedFiles = await gitGetStagedFiles({ gitDir, cwd: process.cwd() })
  if (!stagedFiles.length) {
    error(`Git staging area is empty.`)
    process.exit(1)
  }

  let files = prepareFiles(stagedFiles, config)
  if (files.tasks.every((task) => !task.files.length)) {
    error(`No staged files match any configured task.`)
    process.exit(1)
  }

  return createPipeliner({ process, files }).run()
}

run()
  .then(() => {})
  .catch((e) => {
    if (e.own) {
      error(e.message)
    } else {
      error(e.stack)
    }
    process.exit(1)
  })
