import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { createReporter } from './create-reporter.js'
import { globToRegex } from './glob-to-regex.js'
import { stringArgvToArray } from './utils.js'
import { spawner } from './spawner.js'
import { toArray } from './utils.js'

export async function createTaskRunner(
  files = [],
  config = {},
  repoPath = '',
  cwd = process.cwd(),
  stream = process.stderr
) {
  let { log } = createReporter({ stream })

  let runner = {
    tasks: [],

    async createTasks() {
      for (let pattern of Object.keys(config)) {
        let taskFiles = []
        let matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })

        for (let file of files) {
          file = normalize(relative(cwd, normalize(resolve(repoPath, file))))
          file = file.replace(/\\/g, '/')

          if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
            continue
          }

          if (matches.regex.test(file)) {
            taskFiles.push(resolve(cwd, file))
          }
        }

        let cmd = config[pattern]
        let isFn = typeof cmd === 'function'
        let resolved = isFn ? await cmd(taskFiles) : cmd

        runner.tasks.push({
          isFn,
          pattern,
          cmds: toArray(resolved),
          files: taskFiles,
        })
      }

      return runner
    },

    async runTasks() {
      let errors = []

      try {
        await Promise.all(runner.tasks.map((task) => runner.runTask({ task, errors })))

        if (errors.length) {
          let err = new Error()
          err.tasks = errors.join('\n')
          throw err
        }
      } catch (err) {
        throw err
      }
    },

    async runTask({ task, errors, skiped = false }) {
      let { pattern = '', cmds = [], files = [], isFn = false } = task
      let pad = Math.max(...runner.tasks.map(({ pattern }) => pattern.length))
      let notMatchingPatterns = []

      for (let stringCmd of cmds) {
        if (files.length) {
          let [cmd, ...args] = stringArgvToArray(stringCmd)

          try {
            if (skiped) {
              log(`  ${c.bold(c.gray(pattern.padEnd(pad)))} | SKIPPED | ${stringCmd}`)
              continue
            }

            await spawner(cmd, isFn ? args : args.concat(files), {
              cwd: this.repoPath,
            })

            log(`  ${c.bold(c.green(pattern.padEnd(pad)))} | SUCCESS | ${stringCmd}`)
          } catch (err) {
            log(`  ${c.bold(c.red(pattern.padEnd(pad)))} | FAILED  | ${stringCmd}`)
            errors.push(c.red(`${stringCmd}:\n`) + err)
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
  }

  return await runner.createTasks()
}
