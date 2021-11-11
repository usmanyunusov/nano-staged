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
            for (let sources of await fs.read(changed)) {
              if (sources) {
                let { path, source } = sources
                cache.set(path, source)
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
              cwd: gitDir,
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
            let sources = changed.map((path) => ({ path, source: cache.get(path) }))
            await fs.write(sources)
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
