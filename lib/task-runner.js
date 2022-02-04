import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { globToRegex } from './glob-to-regex.js'
import { stringArgvToArray } from './utils.js'
import { spawner } from './spawner.js'
import { toArray } from './utils.js'

export async function createTaskRunner({
  stream = process.stderr,
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
        let cmd = config[pattern]
        let cmdFn = typeof cmd === 'function'
        let matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })
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

        runner.tasks.push({
          ...task,
          cmds: toArray(
            cmdFn ? await cmd({ files: task.files, type: task.type, pattern: task.pattern }) : cmd
          ),
        })
      }

      return runner
    },

    async run() {
      let errors = []

      try {
        await Promise.all(runner.tasks.map((task) => runner.runTask({ task, errors })))

        if (errors.length) {
          let err = new Error(errors.join('\n\n'))
          err.name = 'TaskRunnerError'
          throw err
        }
      } catch (err) {
        throw err
      }
    },

    async runTask({ task, errors, skiped = false }) {
      let { pattern = '', cmds = [], files = [], cmdFn = false } = task
      let patternPad = Math.max(...runner.tasks.map(({ pattern }) => pattern.length))
      let skipPatterns = []

      function print(color, cmd, files, status) {
        stream.write(
          `  ${color(c.bold(pattern.padEnd(patternPad)))}  ${c.dim(`[ ${status} ]`)}  ${cmd}${c.dim(
            ` (${files} ${files > 1 || files === 'no' ? 'files' : 'file'})`
          )}\n`
        )
      }

      for (let cmd of cmds) {
        if (files.length) {
          let [command, ...args] = stringArgvToArray(cmd)

          try {
            if (skiped) {
              print(c.dim, cmd, files.length, 'skip')
              continue
            }

            await spawner(command, cmdFn ? args : args.concat(files), {
              cwd: repoPath,
            })

            print(c.green, cmd, files.length, 'done')
          } catch (err) {
            print(c.red, cmd, files.length, 'fail')
            errors.push(
              `${c.bgRed(c.black(' ERROR '))} ${c.red(`${pattern} ${cmd}`)}:\n` + err.trim()
            )
            skiped = true
          }
        } else {
          if (!skipPatterns.includes(pattern)) {
            print(c.yellow, cmd, 'no', 'warn')
            skipPatterns.push(pattern)
          }
        }
      }
    },
  }

  return await runner.resolveTasks()
}
