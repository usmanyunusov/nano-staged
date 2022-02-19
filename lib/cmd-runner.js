import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { globToRegex } from './glob-to-regex.js'
import { stringArgvToArray } from './utils.js'
import { TaskRunnerError } from './errors.js'
import { executor } from './executor.js'
import { toArray } from './utils.js'

export function createCmdRunner({
  cwd = process.cwd(),
  type = 'staged',
  rootPath = '',
  config = {},
  files = [],
} = {}) {
  const runner = {
    async generateCmdTasks() {
      const cmdTasks = []

      for (const [pattern, cmds] of Object.entries(config)) {
        const matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })
        const isFn = typeof cmds === 'function'
        const task_files = []
        const tasks = []

        for (let file of files) {
          file = normalize(relative(cwd, normalize(resolve(rootPath, file)))).replace(/\\/g, '/')

          if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
            continue
          }

          if (matches.regex.test(file)) {
            task_files.push(resolve(cwd, file))
          }
        }

        const file_count = task_files.length
        const commands = toArray(isFn ? await cmds({ filenames: task_files, type }) : cmds)
        const suffix = file_count ? file_count + (file_count > 1 ? ' files' : ' file') : 'no files'

        for (const command of commands) {
          const [cmd, ...args] = stringArgvToArray(command)

          if (file_count) {
            tasks.push({
              title: command,
              run: async () =>
                executor(cmd, isFn ? args : args.concat(task_files), {
                  cwd: rootPath,
                }),
              pattern,
            })
          }
        }

        cmdTasks.push({
          title: pattern + c.dim(` - ${suffix}`),
          file_count,
          tasks,
        })
      }

      return cmdTasks
    },

    async run(parentTask) {
      const errors = []

      try {
        await Promise.all(
          parentTask.tasks.map(async (task) => {
            task.parent = parentTask

            try {
              if (task.file_count) {
                task.state = 'run'
                await runner.runTask(task)
                task.state = 'done'
              } else {
                task.state = 'warn'
              }
            } catch (err) {
              task.state = 'fail'
              errors.push(...err)
            }
          })
        )

        if (errors.length) {
          throw new TaskRunnerError(errors.join('\n\n'))
        }
      } catch (err) {
        throw err
      }
    },

    async runTask(parentTask) {
      let skipped = false
      let errors = []

      for (const task of parentTask.tasks) {
        task.parent = parentTask

        try {
          if (skipped) {
            task.state = 'warn'
            continue
          }

          task.state = 'run'
          await task.run()
          task.state = 'done'
        } catch (error) {
          skipped = true
          task.title = c.red(task.title)
          task.state = 'fail'
          errors.push(`${c.red(task.pattern)} ${c.dim('>')} ${task.title}:\n` + error.trim())
        }
      }

      if (errors.length) {
        throw errors
      }
    },
  }

  return runner
}
