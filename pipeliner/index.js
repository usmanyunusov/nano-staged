import { resolve } from 'path'
import pico from 'picocolors'

import { createReporter } from '../create-reporter/index.js'
import { argvStrToArr, toArray } from '../utils/index.js'
import { fileSystem } from '../file-system/index.js'
import { exec as baseExec } from '../exec/index.js'
import { gitWorker } from '../git/index.js'

const ORIGIN_PATCH = 'nano-staged.patch'
const PARTIAL_PATCH = 'nano-staged_partial.patch'

export function pipeliner({
  stream = process.stderr,
  repoPath = process.cwd(),
  dotGitPath = '',
  config = {},
  files = {},
}) {
  let originalPatch = resolve(dotGitPath, `./${ORIGIN_PATCH}`)
  let partialPatch = resolve(dotGitPath, `./${PARTIAL_PATCH}`)

  let git = gitWorker(repoPath)
  let fs = fileSystem()

  let { changedFiles = [], deletedFiles = [], stagedFiles = [], taskedFiles = [] } = files
  let { log, step } = createReporter({ stream })

  return {
    async run() {
      step('Preparing pipeliner')

      try {
        await git.diffPatch(originalPatch)
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
        step('Backing up unstaged changes for staged files.')

        try {
          await git.diffPatch(partialPatch, [...changedFiles, ...deletedFiles])
          await git.checkout([...changedFiles, ...deletedFiles])

          log(pico.dim(`  ${pico.green('»')} Done backing up unstaged changes.`))
        } catch (err) {
          /* c8 ignore next 4 */
          log(pico.dim(`  ${pico.red('»')} Fail backing up unstaged changes.`))
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.runTasks()
    },

    async runTask({ task, output, skiped = false }) {
      let [pattern = '', cmds = []] = task
      let notMatchingPatterns = []

      for (let stringCmd of toArray(cmds)) {
        let files = taskedFiles.filter((file) => file[0] === pattern).map((file) => file[1])

        if (files.length) {
          let [cmd, ...args] = argvStrToArr(stringCmd)

          try {
            if (skiped) {
              log(`  ${pico.bold(pico.gray(pattern.padEnd(output.size)))} ${stringCmd}`)
              continue
            }

            await baseExec(cmd, [...args, ...files], {
              cwd: repoPath,
              preferLocal: true,
              env: { ...process.env, FORCE_COLOR: '1' },
            })

            log(`  ${pico.bold(pico.green(pattern.padEnd(output.size)))} ${stringCmd}`)
          } catch (err) {
            log(`  ${pico.bold(pico.red(pattern.padEnd(output.size)))} ${stringCmd}`)
            output.errors.push(pico.red(`${stringCmd}:\n`) + err)
            skiped = true
          }
        } else {
          if (!notMatchingPatterns.includes(pattern)) {
            log(
              `  ${pico.bold(
                pico.yellow(pattern.padEnd(output.size))
              )} no staged files matching the pattern were found.`
            )
            notMatchingPatterns.push(pattern)
          }
        }
      }
    },

    async runTasks() {
      step('Running tasks')

      try {
        let output = {
          errors: [],
          size: Math.max(...Object.keys(config).map((pattern) => pattern.length)),
        }

        await Promise.all(Object.entries(config).map((task) => this.runTask({ task, output })))

        if (output.errors.length) {
          let err = new Error()
          err.tasks = output.errors.join('\n')
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
        /* c8 ignore next 5 */
        if (!(await git.exec(['diff', 'HEAD']))) {
          let err = new Error()
          err.tasks = pico.yellow('Prevented an empty git commit.')
          throw err
        }

        await git.add(stagedFiles)
        log(pico.dim(`  ${pico.green('»')} Done adding up all task modifications to index.`))
      } catch (err) {
        /* c8 ignore next 4 */
        log(pico.dim(`  ${pico.red('»')} Fail adding up all task modifications to index.`))
        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async restoreUnstagedFiles() {
      if (changedFiles.length || deletedFiles.length) {
        step('Restoring unstaged changes for staged files.')

        try {
          await git.applyPatch(partialPatch)
          log(pico.dim(`  ${pico.green('»')} Done restoring up unstaged changes.`))
        } catch (err) {
          /* c8 ignore next 8 */
          try {
            await git.applyPatch(partialPatch, true)
          } catch (error) {
            log(pico.dim(`  ${pico.red('»')} Merge conflict!!! Unstaged changes not restored.`))
            await this.restoreOriginalState()
            throw err
          }
        }
      }

      await this.cleanUp()
    },

    async restoreOriginalState() {
      step('Restoring to its original state')

      try {
        await git.checkout('.')

        let hasPatch = await fs.read(originalPatch)
        if (hasPatch.toString()) {
          await git.applyPatch(originalPatch)
        }

        log(pico.dim(`  ${pico.green('»')} Done restoring up to its original state.`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(pico.dim(`  ${pico.red('»')} Fail restoring up to its original state.`))
        throw err
      }

      await this.cleanUp()
    },

    async cleanUp() {
      step('Removing patch files')

      try {
        await fs.delete(originalPatch)

        if (changedFiles.length || deletedFiles.length) {
          await fs.delete(partialPatch)
        }

        log(pico.dim(`  ${pico.green('»')} Done removing up patch files.`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(pico.dim(`  ${pico.red('»')} Fail removing up patch files.`))
        throw err
      }
    },
  }
}
