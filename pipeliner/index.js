import pico from 'picocolors'
import { resolve } from 'path'

import { createReporter } from '../create-reporter/index.js'
import { spawn, stringToArgv } from '../utils/index.js'
import { fileSystem } from '../file-system/index.js'
import { gitWorker } from '../git/index.js'

const PATCH_ORIGIN = 'nano-staged.patch'

export function pipeliner({
  stream = process.stderr,
  cwd = process.cwd(),
  dotGitPath = '',
  files = {},
}) {
  let patchPath = resolve(dotGitPath, `./${PATCH_ORIGIN}`)
  let git = gitWorker(cwd)
  let fs = fileSystem()
  let cache = new Map()

  let { changedFiles = [], deletedFiles = [], allTasks = [], stagedFiles = [] } = files
  let { log, step } = createReporter({ stream })

  return {
    async run() {
      step('Preparing pipeliner')

      try {
        await git.diffPatch(patchPath)
        log(pico.dim(`  ${pico.green('»')} Done backing up original repo state.`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(pico.dim(`  ${pico.red('»')} Fail backing up original repo state.`))
        throw err
      }

      await this.backupUnstagedFiles()
    },

    async backupUnstagedFiles() {
      if (changedFiles.length || deletedFiles.length) {
        step('Backing up unstaged changes for staged files')

        try {
          if (changedFiles.length) {
            for (let files of await fs.read(changedFiles)) {
              if (files) {
                let { path, content } = files
                cache.set(path, content)
              }
            }
          }

          await git.checkout([...changedFiles, ...deletedFiles])
          log(pico.dim(`  ${pico.green('»')} Done caching and removing unstaged changes`))
        } catch (err) {
          /* c8 ignore next 4 */
          log(pico.dim(`  ${pico.red('»')} Fail caching and removing unstaged changes`))
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.runTasks()
    },

    async runTask(tasks) {
      for (let task of tasks) {
        if (task.files.length) {
          let [cmd, ...args] = stringToArgv(task.cmd)

          try {
            await spawn(cmd, [...args, ...task.files], {
              cwd,
              env: { ...process.env, FORCE_COLOR: '1' },
            })
            log(`  ${pico.bold(pico.green(task.pattern))} ${task.cmd}`)
          } catch (err) {
            /* c8 ignore next 2 */
            log(`  ${pico.bold(pico.red(task.pattern))} ${task.cmd}`)
            throw `${pico.red(`${task.cmd}:\n`) + err}`
          }
        } else {
          /* c8 ignore next 2 */
          log(`  ${pico.yellow(task.pattern)} no staged files matching the pattern were found`)
        }
      }
    },

    async runTasks() {
      step('Running tasks')

      try {
        let result = await Promise.allSettled(allTasks.map((subTasks) => this.runTask(subTasks)))
        let errors = result.filter((i) => i.status === 'rejected')

        if (errors.length) {
          let err = new Error()
          err.tasks = errors.map((e) => e.reason).join('\n')
          throw err
        }
      } catch (err) {
        await this.restoreOriginalState()
        throw err
      }

      await this.applyModifications()
    },

    async applyModifications() {
      step('Applying modifications')

      try {
        await git.add(stagedFiles)
        log(pico.dim(`  ${pico.green('»')} Done adding all task modifications to index`))
      } catch (err) {
        /* c8 ignore next 4 */
        log(pico.dim(`  ${pico.red('»')} Fail adding all task modifications to index`))
        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async restoreUnstagedFiles() {
      if (changedFiles.length || deletedFiles.length) {
        step('Restoring unstaged changes for staged files')

        try {
          if (deletedFiles.length) {
            await fs.delete(deletedFiles)
          }

          if (changedFiles.length) {
            let files = changedFiles.map((path) => ({ path, content: cache.get(path) }))
            await fs.write(files)
          }

          log(pico.dim(`  ${pico.green('»')} Done deleting removed and restoring changed files`))
        } catch (err) {
          /* c8 ignore next 4 */
          log(pico.dim(`  ${pico.red('»')} Fail deleting removed and restoring changed files`))
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.cleanUp()
    },

    async restoreOriginalState() {
      step('Restoring original state')

      try {
        await git.checkout('.')

        let hasPatch = await fs.read(patchPath)
        if (hasPatch.toString()) {
          await git.applyPatch(patchPath)
        }

        log(pico.dim(`  ${pico.green('»')} Done restoring`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(pico.dim(`  ${pico.red('»')} Fail restoring`))
        throw err
      }

      await this.cleanUp()
    },

    async cleanUp() {
      step('Removing patch file')

      try {
        cache.clear()
        await fs.delete(patchPath)
        log(pico.dim(`  ${pico.green('»')} Done clearing cache and removing patch file`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(pico.dim(`  ${pico.red('»')} Fail clearing cache and removing patch file`))
        throw err
      }
    },
  }
}
