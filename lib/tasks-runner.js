import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { globToRegex } from './glob-to-regex.js'
import { stringArgvToArray } from './utils.js'
import { TaskRunnerError } from './errors.js'
import { executor } from './executor.js'
import { toArray } from './utils.js'

export async function createTasksRunner({
  cwd = process.cwd(),
  type = 'staged',
  repoPath = '',
  config = {},
  files = [],
} = {}) {
  const runner = {
    tasks: [],

    async resolveTasks() {
      for (const pattern of Object.keys(config)) {
        const matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })
        const cmd = config[pattern]
        const cmdFn = typeof cmd === 'function'
        const task = {
          files: [],
          pattern,
          cmdFn,
          type,
        }

        for (let file of files) {
          file = normalize(relative(cwd, normalize(resolve(repoPath, file)))).replace(/\\/g, '/')

          if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
            continue
          }

          if (matches.regex.test(file)) {
            task.files.push(resolve(cwd, file))
          }
        }

        task.cmds = toArray(cmdFn ? await cmd({ files: task.files, type: task.type }) : cmd)
        runner.tasks.push(task)
      }

      return runner
    },

    async run(spinner) {
      const errors = []

      try {
        await Promise.all(
          runner.tasks.map(async (task) => {
            const { files, pattern } = task
            const spin = spinner
              .create(pattern + c.dim(` - ${files.length} ${files.length > 1 ? 'files' : 'file'}`))
              .start()

            try {
              if (files.length) {
                await runner.runTask({ task, spinner: spin })
                spin.success()
              } else {
                spin.warning(pattern + c.dim(` — no files`))
              }
            } catch (err) {
              spin.error()
              errors.push(...err)
            }
          })
        )

        if (errors.length) {
          throw new TaskRunnerError(errors.join('\n\n'))
        }

        spinner.spins = []
      } catch (err) {
        throw err
      }
    },

    async runTask({ task, spinner }) {
      let skipped = false
      let errors = []

      for (const cmd of task.cmds) {
        const spin = spinner.create(cmd).start()
        const [command, ...args] = stringArgvToArray(cmd)

        try {
          if (skipped) {
            spin.warning()
            continue
          }

          await executor(command, task.cmdFn ? args : args.concat(task.files), {
            cwd: repoPath,
          })

          spin.success()
        } catch (error) {
          errors.push(`${c.red(cmd)}:\n` + error.trim())
          skipped = true
          spin.error(c.red(cmd))
        }
      }

      if (errors.length) {
        throw errors
      }
    },
  }

  return await runner.resolveTasks()
}
