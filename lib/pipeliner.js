import { resolve } from 'path'
import c from 'picocolors'

import { createReporter } from './create-reporter.js'
import { stringArgvToArray } from './utils.js'
import { fileSystem } from './file-system.js'
import { spawner } from './spawner.js'
import { gitWorker } from './git.js'

const ORIGIN_PATCH = 'nano-staged.patch'
const PARTIAL_PATCH = 'nano-staged_partial.patch'

function done(msg = '') {
  return c.dim(`  ${c.gray('»')} ${msg}`)
}

/* c8 ignore next 4 */
function fail(msg = '') {
  return c.dim(`  ${c.gray('»')} ${msg}`)
}

export function pipeliner({
  stream = process.stderr,
  repoPath = process.cwd(),
  allowEmpty = false,
  unstaged = false,
  dotGitPath = '',
  files = {},
}) {
  let originalPatch = resolve(dotGitPath, `./${ORIGIN_PATCH}`)
  let partialPatch = resolve(dotGitPath, `./${PARTIAL_PATCH}`)

  let git = gitWorker(repoPath)
  let fs = fileSystem()

  let { changedFiles = [], deletedFiles = [], workingFiles = [], resolvedTasks = [] } = files
  let { log, step } = createReporter({ stream })

  return {
    async run() {
      step('Preparing pipeliner')

      try {
        await git.diff(originalPatch)
        log(done(`Done backing up original repo state.`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(fail(`Fail backing up original repo state.`))
        throw err
      }

      unstaged ? await this.runTasks() : await this.backupUnstagedFiles()
    },

    async backupUnstagedFiles() {
      if (changedFiles.length || deletedFiles.length) {
        step('Backing up unstaged changes for staged files.')

        try {
          await git.diff(partialPatch, [...changedFiles, ...deletedFiles])
          await git.checkout([...changedFiles, ...deletedFiles])

          log(done(`Done backing up unstaged changes.`))
        } catch (err) {
          /* c8 ignore next 4 */
          log(fail(`Fail backing up unstaged changes.`))
          await this.restoreOriginalState()
          throw err
        }
      }

      await this.runTasks()
    },

    async runTask({ task, output, skiped = false }) {
      let { pattern = '', cmds = [], files = [], isFn = false } = task
      let notMatchingPatterns = []
      let pad = output.size

      for (let stringCmd of cmds) {
        if (files.length) {
          let [cmd, ...args] = stringArgvToArray(stringCmd)

          try {
            if (skiped) {
              log(`  ${c.bold(c.gray(pattern.padEnd(pad)))} | SKIPPED | ${stringCmd}`)
              continue
            }

            await spawner(cmd, isFn ? args : args.concat(files), {
              cwd: repoPath,
            })

            log(`  ${c.bold(c.green(pattern.padEnd(pad)))} | SUCCESS | ${stringCmd}`)
          } catch (err) {
            log(`  ${c.bold(c.red(pattern.padEnd(pad)))} | FAILED  | ${stringCmd}`)
            output.errors.push(c.red(`${stringCmd}:\n`) + err)
            skiped = true
          }
        } else {
          if (!notMatchingPatterns.includes(pattern)) {
            log(
              `  ${c.bold(
                c.yellow(pattern.padEnd(pad))
              )} | SKIPPED | no files matching the pattern were found.`
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
          size: Math.max(...resolvedTasks.map(({ pattern }) => pattern.length)),
        }

        await Promise.all(resolvedTasks.map((task) => this.runTask({ task, output })))

        if (output.errors.length) {
          let err = new Error()
          err.tasks = output.errors.join('\n')
          throw err
        }
      } catch (err) {
        await this.restoreOriginalState()
        throw err
      }

      unstaged ? await this.cleanUp() : await this.applyModifications()
    },

    async applyModifications() {
      step('Applying modifications')

      try {
        /* c8 ignore next 8 */
        if (!(await git.exec(['diff', 'HEAD'])) && !allowEmpty) {
          let err = new Error()
          err.emptyCommit = true
          err.tasks = c.yellow(
            'Nano Staged prevented an empty git commit.\nUse the --allow-empty option to continue, or check your task configuration'
          )
          throw err
        }

        await git.add(workingFiles)
        log(done(`Done adding up all task modifications to index.`))
      } catch (err) {
        /* c8 ignore next 9 */
        log(fail(`Fail adding up all task modifications to index.`))

        if (!!err.emptyCommit) {
          log(fail(`Prevented an empty git commit.`))
        }

        await this.restoreOriginalState()
        throw err
      }

      await this.restoreUnstagedFiles()
    },

    async restoreUnstagedFiles() {
      if (changedFiles.length || deletedFiles.length) {
        step('Restoring unstaged changes for staged files.')

        try {
          await git.apply(partialPatch)
          log(done(`Done restoring up unstaged changes.`))
        } catch (err) {
          /* c8 ignore next 8 */
          try {
            await git.apply(partialPatch, true)
          } catch (error) {
            log(fail(`Merge conflict!!! Unstaged changes not restored.`))
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

        let originalPatchBuffer = await fs.read(originalPatch)
        if (originalPatchBuffer.toString()) {
          await git.apply(originalPatch)
        }

        log(done(`Done restoring up to its original state.`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(fail(`Fail restoring up to its original state.`))
        throw err
      }

      await this.cleanUp()
    },

    async cleanUp() {
      step('Removing patch files')

      try {
        await fs.delete(originalPatch)

        if (!unstaged && (changedFiles.length || deletedFiles.length)) {
          await fs.delete(partialPatch)
        }

        log(done(`Done removing up patch files.`))
      } catch (err) {
        /* c8 ignore next 3 */
        log(fail(`Fail removing up patch files.`))
        throw err
      }
    },
  }
}
