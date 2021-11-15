import pico from 'picocolors'

import { loadConfig, validConfig } from '../config/index.js'
import { prepareFiles } from '../prepare-files/index.js'
import { pipeliner } from '../pipeliner/index.js'
import { reporter } from '../reporter/index.js'
import { showVersion } from '../utils/index.js'
import { gitWorker } from '../git/index.js'

export default async function run(opts = {}, logger = reporter({ stream: process.stderr })) {
  let { log, info } = logger
  let { cwd = process.cwd() } = opts

  showVersion(log)

  let git = gitWorker({ cwd })
  let { gitRootPath, gitConfigPath } = await git.repoRoot(cwd)
  if (!gitRootPath) {
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

  let stagedFiles = await git.getStagedFiles()
  if (!stagedFiles.length) {
    info(`Git staging area is empty.`)
    return
  }

  let files = prepareFiles({ entries: stagedFiles, config, gitRootPath, cwd })
  if (files.tasks.every((subTasks) => subTasks.every((task) => !task.files.length))) {
    info(`No staged files match any configured task.`)
    return
  }

  let pl = pipeliner({ process, files, gitRootPath, gitConfigPath, logger })

  try {
    await pl.run()
  } catch (err) {
    if (err.cmds) {
      log('\n' + err.cmds)
    } else if (err.own) {
      log('\n' + pico.red(err.message))
    } else if (err.stack) {
      log('\n' + pico.red(err.stack))
    } else {
      log('\n' + pico.red(err))
    }
  }
}
