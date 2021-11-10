import { writeFiles, readFiles, deleteFiles } from '../files/index.js'
import { setCache, getCache, clearCache } from '../cache/index.js'
import { spawn, stringToArgv } from '../utils/index.js'
import { createReporter } from '../reporter/index.js'
import pico from 'picocolors'
import {
  gitCreateStash,
  gitApplyStash,
  gitResetHard,
  gitDropStash,
  gitCheckout,
  gitAdd,
} from '../git/index.js'

export function createPipeliner({ process, files }) {
  let reporter = createReporter({ stream: process.stderr })
  let { changed, deleted, tasks, staged } = files

  return {
    async run() {
      reporter.step('Preparing pipeliner')

      try {
        await gitCreateStash()
        reporter.log(pico.dim(`  » Done backing up original state to git stash`))
      } catch (err) {
        throw err
      }

      await this.backupUnstagedFiles()
    },

    async backupUnstagedFiles() {
      if (changed.length || deleted.length) {
        reporter.step('Backing unstaged changes for staged files')

        try {
          if (changed.length) {
            for (let sources of await readFiles(changed)) {
              if (sources.length) {
                let [path, source] = sources
                setCache(path, source)
              }
            }

            reporter.log(pico.dim(`  » Done cached for unstaged changes`))
          }

          await gitCheckout([...changed, ...deleted])
          reporter.log(pico.dim(`  » Done remove unstaged changes for staged files`))
        } catch (err) {
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
            await spawn(cmd, [...args, ...task.files])
            reporter.log(`  ${pico.bold(pico.green(task.pattern))} ${task.cmd}`)
          } catch (err) {
            reporter.log(`  ${pico.bold(pico.red(task.pattern))} ${task.cmd}`)
            throw err
          }
        } else {
          reporter.log(`  ${pico.yellow(task.pattern)} no staged files match`)
        }
      }
    },

    async runTasks() {
      reporter.step('Running tasks')

      try {
        await Promise.all(tasks.map((subTasks) => this.runTask(subTasks)))
      } catch (err) {
        await this.restoreOriginalState()
        throw err
      }

      await this.applyModifications()
    },

    async applyModifications() {
      reporter.step('Applying modifications')

      try {
        await gitAdd(staged)
        reporter.log(pico.dim(`  » Added task modifications to index`))
      } catch (err) {
        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async restoreUnstagedFiles() {
      if (changed.length || deleted.length) {
        reporter.step('Restoring unstaged changes')

        try {
          if (deleted.length) {
            await deleteFiles(deleted)
            reporter.log(pico.dim(`  » Done delete deleted files`))
          }

          if (changed.length) {
            let sources = changed.map((path) => [path, getCache(path)])
            await writeFiles(sources)
            reporter.log(pico.dim(`  » Done revert changes`))
          }
        } catch (err) {
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.cleanUp()
    },

    async restoreOriginalState() {
      reporter.step('Reverting to original state because of errors')

      try {
        clearCache()
        await gitResetHard()
        await gitApplyStash()
      } catch (err) {
        throw err
      }

      await this.cleanUp()
    },

    async cleanUp() {
      reporter.step('Cleaning up')

      try {
        clearCache()
        await gitDropStash()
        reporter.log(pico.dim(`  » Done clearing cache abd dropping backup git stash`))
      } catch (err) {
        throw err
      }
    },
  }
}
