import { spawn, stringToArgv } from '../utils/index.js'
import { createCache } from '../cache/index.js'
import { reporter } from '../reporter/index.js'
import { fileSystem } from '../fs/index.js'
import { gitWorker } from '../git/index.js'
import { resolve } from 'path'
import pico from 'picocolors'

const PATCH_ORIGIN = 'nano-staged.patch'

export function pipeliner({ process, files, gitConfigDir, gitDir }) {
  let patchPath = resolve(gitConfigDir, `./${PATCH_ORIGIN}`)
  let { log, step } = reporter({ stream: process.stderr })
  let { changed, deleted, tasks, staged } = files
  let git = gitWorker({ cwd: gitDir })
  let cache = createCache()
  let fs = fileSystem()

  return {
    async run() {
      step('Preparing pipeliner')

      try {
        await git.diffPatch(patchPath)
        log(pico.dim(`  » Done backing up original state`))
      } catch (err) {
        throw err
      }

      await this.backupUnstagedFiles()
    },

    async backupUnstagedFiles() {
      if (changed.length || deleted.length) {
        step('Backing unstaged changes for staged files')

        try {
          if (changed.length) {
            for (let sources of await fs.read(changed)) {
              if (sources.length) {
                let [path, source] = sources
                cache.set(path, source)
              }
            }

            log(pico.dim(`  » Done cached for unstaged changes`))
          }

          await git.checkout([...changed, ...deleted])
          log(pico.dim(`  » Done remove unstaged changes for staged files`))
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
            log(`  ${pico.bold(pico.green(task.pattern))} ${task.cmd}`)
          } catch (err) {
            log(`  ${pico.bold(pico.red(task.pattern))} ${task.cmd}`)
            throw err
          }
        } else {
          log(`  ${pico.yellow(task.pattern)} no staged files match`)
        }
      }
    },

    async runTasks() {
      step('Running tasks')

      try {
        await Promise.all(tasks.map((subTasks) => this.runTask(subTasks)))
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
        log(pico.dim(`  » Done applying`))
      } catch (err) {
        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async restoreUnstagedFiles() {
      if (changed.length || deleted.length) {
        step('Restoring unstaged changes')

        try {
          if (deleted.length) {
            await fs.delete(deleted)
            log(pico.dim(`  » Done delete deleted files`))
          }

          if (changed.length) {
            let sources = changed.map((path) => [path, cache.get(path)])
            await fs.write(sources)
            log(pico.dim(`  » Done revert changes`))
          }
        } catch (err) {
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
        await git.applyPatch(patchPath)
        log(pico.dim(`  » Done restoring`))
      } catch (err) {
        throw err
      }

      await this.cleanUp()
    },

    async cleanUp() {
      step('Removing patch file')

      try {
        cache.clear()
        await fs.delete(patchPath)
        log(pico.dim(`  » Done removing`))
      } catch (err) {
        throw err
      }
    },
  }
}
