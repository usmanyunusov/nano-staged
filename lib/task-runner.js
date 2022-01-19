import { normalize, relative, resolve, isAbsolute } from 'path'
import c from 'picocolors'

import { createReporter } from './create-reporter.js'
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
  let { log } = createReporter({ stream })

  let runner = {
    tasks: [],

    async mount() {
      for (let pattern of Object.keys(config)) {
        let taskFiles = []
        let matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })

        for (let file of files) {
          file = normalize(relative(cwd, normalize(resolve(repoPath, file)))).replace(/\\/g, '/')

          if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
            continue
          }

          if (matches.regex.test(file)) {
            taskFiles.push(resolve(cwd, file))
          }
        }

        let cmd = config[pattern]
        let isFn = typeof cmd === 'function'
        let task = {
          files: taskFiles,
          pattern,
          type,
        }

        runner.tasks.push({ ...task, cmds: toArray(isFn ? await cmd(task) : cmd) })
      }

      return runner
    },

    async run() {
      let errors = []

      try {
        await Promise.all(runner.tasks.map((task) => runner.runTask({ task, errors })))

        if (errors.length) {
          let err = new Error(errors.join('\n'))
          err.name = 'TaskError'
          throw err
        }
      } catch (err) {
        throw err
      }
    },

    async runTask({ task, errors, skiped = false }) {
      let { pattern = '', cmds = [], files = [] } = task
      let patternPad = Math.max(...runner.tasks.map(({ pattern }) => pattern.length))
      let skipPatterns = []
      let report = (color, cmd, files, status) =>
        log(
          `  ${color(c.bold(pattern.padEnd(patternPad)))}  ${c.dim(`[ ${status} ]`)}  ${cmd}${c.dim(
            ` - ${files} ${files > 1 || files === 'no' ? 'files' : 'file'}`
          )}`
        )

      for (let cmd of cmds) {
        if (files.length) {
          let [command, ...args] = stringArgvToArray(cmd)

          try {
            if (skiped) {
              report(c.dim, cmd, files.length, 'skip')
              continue
            }

            await spawner(command, args.concat(files), {
              cwd: repoPath,
            })

            report(c.green, cmd, files.length, 'done')
          } catch (err) {
            report(c.red, cmd, files.length, 'fail')
            errors.push(c.red(`${pattern} ${cmd}:\n`) + err)
            skiped = true
          }
        } else {
          if (!skipPatterns.includes(pattern)) {
            report(c.yellow, cmd, 'no', 'warn')
            skipPatterns.push(pattern)
          }
        }
      }
    },
  }

  return await runner.mount()
}
