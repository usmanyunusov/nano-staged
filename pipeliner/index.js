import { resolve } from 'path'
import pico from 'picocolors'

import { spawn, stringToArgv } from '../utils/index.js'
import { reporter } from '../reporter/index.js'
import { fileSystem } from '../fs/index.js'
import { gitWorker } from '../git/index.js'

const PATCH_ORIGIN = 'nano-staged.patch'

export function pipeliner({
  logger = reporter({ stream: process.stderr }),
  gitConfigPath = null,
  gitRootPath = null,
  files = {},
}) {
  let patchPath = resolve(gitConfigPath, `./${PATCH_ORIGIN}`)
  let git = gitWorker(gitRootPath)
  let fs = fileSystem()

  let { changed = [], deleted = [], tasks = [], staged = [] } = files
  let { log, step } = logger

  let cache = new Map()

  return {
    async run() {
      step('Preparing pipeliner')

      try {
        await git.diffPatch(patchPath)
        log(pico.dim(`  ${pico.green('»')} Done backing up original repo state.`))
      } catch (err) {
        log(pico.dim(`  ${pico.red('»')} Fail backing up original repo state.`))
        throw err
      }

      await this.backupUnstagedFiles()
    },

    async backupUnstagedFiles() {
      if (changed.length || deleted.length) {
        step('Backing up unstaged changes for staged files')

        try {
          if (changed.length) {
            for (let files of await fs.read(changed)) {
              if (files) {
                let { path, content } = files
                cache.set(path, content)
              }
            }
          }

          await git.checkout([...changed, ...deleted])
          log(pico.dim(`  ${pico.green('»')} Done caching and removing unstaged changes`))
        } catch (err) {
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
              cwd: gitRootPath,
              env: { ...process.env, FORCE_COLOR: '1' },
            })
            log(`  ${pico.bold(pico.green(task.pattern))} ${task.cmd}`)
          } catch (err) {
            log(`  ${pico.bold(pico.red(task.pattern))} ${task.cmd}`)
            throw `${pico.red(`${task.cmd}:\n`) + err}`
          }
        } else {
          log(`  ${pico.yellow(task.pattern)} no staged files match`)
        }
      }
    },

    async runTasks() {
      step('Running tasks')

      try {
        let result = await Promise.allSettled(tasks.map((subTasks) => this.runTask(subTasks)))
        let errors = result.filter((i) => i.status === 'rejected')

        if (errors.length) {
          let err = new Error()
          err.cmds = errors.map((e) => e.reason).join('\n')
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
        await git.add(staged)
        log(pico.dim(`  ${pico.green('»')} Done adding all task modifications to index`))
      } catch (err) {
        log(pico.dim(`  ${pico.red('»')} Fail adding all task modifications to index`))
        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async restoreUnstagedFiles() {
      if (changed.length || deleted.length) {
        step('Restoring unstaged changes for staged files')

        try {
          if (deleted.length) {
            await fs.delete(deleted)
          }

          if (changed.length) {
            let files = changed.map((path) => ({ path, content: cache.get(path) }))
            await fs.write(files)
          }

          log(pico.dim(`  ${pico.green('»')} Done deleting removed and restoring changed files`))
        } catch (err) {
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

        if (await git.checkPatch(patchPath)) {
          await git.applyPatch(patchPath)
        }

        log(pico.dim(`  ${pico.green('»')} Done restoring`))
      } catch (err) {
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
        log(pico.dim(`  ${pico.red('»')} Fail clearing cache and removing patch file`))
        throw err
      }
    },
  }
}
