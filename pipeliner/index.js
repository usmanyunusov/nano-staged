import { writeFiles, readFiles, deleteFiles } from '../files/index.js'
import { setCache, getCache, clearCache } from '../cache/index.js'
import { spawn, stringToArgv } from '../utils/index.js'
import pico from 'picocolors'
import {
  gitCreateStash,
  gitApplyStash,
  gitResetHard,
  gitDropStash,
  gitCheckout,
  gitAdd,
} from '../git/index.js'

export function createPipeliner({ files }) {
  let { changed, deleted, tasks, staged } = files

  return {
    async run() {
      await this.preparingPipline()
    },

    async preparingPipline() {
      console.log(pico.green('Preparing piplines...'))

      try {
        await gitCreateStash()
      } catch (err) {
        throw err
      }

      await this.backupUnstagedFiles()
    },

    async backupUnstagedFiles() {
      if (changed.length || deleted.length) {
        try {
          if (changed.length) {
            console.log(pico.green('Backup unstaged changes for staged files...'))
            let sources = await readFiles(changed)

            for (let [path, source] of sources) {
              setCache(path, source)
            }
          }

          console.log(pico.green('Discard unstaged changes in working directory...'))
          await gitCheckout([...changed, ...deleted])
        } catch (err) {
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.runTasks()
    },

    async restoreUnstagedFiles() {
      if (changed.length || deleted.length) {
        console.log(pico.green('Restore unstaged changes for staged files...'))

        try {
          if (deleted.length) {
            await deleteFiles(deleted)
          }

          if (changed.length) {
            let sources = changed.map((path) => [path, getCache(path)])
            await writeFiles(sources)
          }
        } catch (err) {
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.clean()
    },

    async runTasks() {
      console.log(pico.green('Run tasks...'))

      try {
        async function runTask() {
          let task = tasks.shift()

          if (!task) return

          if (task.files.length) {
            console.log(pico.green(`  Run task for ${task.pattern}:`))
            console.log(pico.green(`  - ${task.cmd}`))

            let [cmd, ...args] = stringToArgv(task.cmd)
            await spawn(cmd, [...args, ...task.files])
          }

          await runTask()
        }

        await runTask()
        await gitAdd(staged)
      } catch (err) {
        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async clean() {
      console.log(pico.green('Clearing...'))
      clearCache()

      try {
        await gitDropStash()
      } catch (err) {
        throw err
      }
    },

    async restoreOriginalState() {
      console.log(pico.green('Restore original state for repo...'))
      clearCache()

      try {
        await gitResetHard()
        await gitApplyStash()
      } catch (err) {
        throw err
      }

      await this.clean()
    },
  }
}
