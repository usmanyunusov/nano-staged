import { resolve } from 'path'
import pico from 'picocolors'

import { spawn, stringToArgv, toArray } from '../utils/index.js'
import { createReporter } from '../create-reporter/index.js'
import { fileSystem } from '../file-system/index.js'
import { gitWorker } from '../git/index.js'

const PATCH_ORIGIN = 'nano-staged.patch'

export function pipeliner({
  stream = process.stderr,
  repoPath = process.cwd(),
  dotGitPath = '',
  config = {},
  files = {},
}) {
  let patchPath = resolve(dotGitPath, `./${PATCH_ORIGIN}`)
  let git = gitWorker(repoPath)
  let fs = fileSystem()
  let cache = new Map()

  let { changedFiles = [], deletedFiles = [], stagedFiles = [], taskedFiles = [] } = files
  let { log, step, print } = createReporter({ stream })

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

    async runTask({ task, output, skiped = false }) {
      let [pattern = '', cmds = []] = task

      for (let stringCmd of toArray(cmds)) {
        let files = taskedFiles.filter((file) => file[0] === pattern).map((file) => file[1])

        if (files.length) {
          let [cmd, ...args] = stringToArgv(stringCmd)

          try {
            if (skiped) {
              print(pico.gray('•  '))
              output.msg.push(`  ${pico.bold(pico.gray(pattern.padEnd(output.size)))} ${stringCmd}`)
              continue
            }

            await spawn(cmd, [...args, ...files], {
              cwd: repoPath,
              env: { ...process.env, FORCE_COLOR: '1' },
            })

            print(pico.green('•  '))
            output.msg.push(`  ${pico.bold(pico.green(pattern.padEnd(output.size)))} ${stringCmd}`)
          } catch (err) {
            print(pico.red('•  '))
            output.msg.push(`  ${pico.bold(pico.red(pattern.padEnd(output.size)))} ${stringCmd}`)
            output.err.push(pico.red(`${stringCmd}:\n`) + err)
            skiped = true
          }
        } else {
          print(pico.yellow('•  '))
          output.msg.push(
            `  ${pico.bold(
              pico.yellow(pattern.padEnd(output.size))
            )} no staged files matching the pattern were found`
          )
        }
      }
    },

    async runTasks() {
      step('Running tasks')

      let output = {
        msg: [],
        err: [],
        size: Math.max(...Object.keys(config).map((pattern) => pattern.length)),
      }

      try {
        print('  ')
        await Promise.all(Object.entries(config).map((task) => this.runTask({ task, output })))
        log('\n\n' + output.msg.join('\n') + '\n')

        if (output.err.length) {
          let err = new Error()
          err.tasks = output.err.join('\n')
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
