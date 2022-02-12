import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { globToRegex } from './glob-to-regex.js'
import { stringArgvToArray } from './utils.js'
import { TaskRunnerError } from './error.js'
import { spawner } from './spawner.js'
import { toArray } from './utils.js'

export async function createTaskRunner({
  cwd = process.cwd(),
  type = 'staged',
  repoPath = '',
  config = {},
  files = [],
} = {}) {
  let runner = {
    tasks: [],

    async resolveTasks() {
      for (let pattern of Object.keys(config)) {
        let matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })
        let cmd = config[pattern]
        let cmdFn = typeof cmd === 'function'

        let task = {
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
      let errors = []

      try {
        await Promise.all(
          runner.tasks.map(async (task) => {
            let { files, pattern } = task
            let title = pattern + c.dim(` - ${files.length} ${files.length > 1 ? 'files' : 'file'}`)
            let spin = spinner.create(title).start()

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

        spinner.collups()
      } catch (err) {
        throw err
      }
    },

    async runTask({ task = {}, spinner }) {
      let { cmds = [], files = [], cmdFn = false } = task

      let skipped = false
      let errors = []

      for (let cmd of cmds) {
        let spin = spinner.create(cmd).start()
        let [command, ...args] = stringArgvToArray(cmd)

        try {
          if (skipped) {
            spin.warning()
            continue
          }

          await spawner(command, cmdFn ? args : args.concat(files), {
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
