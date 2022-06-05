import { normalize, relative, resolve, isAbsolute } from 'path'
import fs from 'fs'

import { str_argv_to_array, to_array, split_in_chunks } from './utils.js'
import { NanoStagedError } from './error.js'
import { create_debug } from './debug.js'
import { executor } from './executor.js'
import { create_task } from './task.js'
import { create_git } from './git.js'
import { globex } from './globex.js'
import c from './colors.js'

export function create_runner({
  max_arg_length,
  file_chunks,
  allow_empty,
  git_paths,
  stream,
  config,
  type,
  cwd,
}) {
  const debug = create_debug('nano-staged:runner')
  const git = create_git(git_paths.root)

  const patch_unstaged = resolve(git_paths.dot, './nano-staged_partial.patch')
  const patch_original = resolve(git_paths.dot, './nano-staged.patch')
  const should_backup = type !== 'diff' && type !== 'unstaged'
  const matched_files = new Set()

  const root = { skip_all: false, revert: false, clear: true, errors: [], children: [] }
  const is_tty = !create_debug.enabled && !process.env.CI && process.env.TERM !== 'dumb'
  const tasker = create_task(root, { is_tty, stream })

  function has_patch(path) {
    debug('Reading patch `%s`', path)

    try {
      const buffer = path && fs.readFileSync(path)
      return buffer && buffer.toString() ? true : false
    } catch {
      return false
    }
  }

  const runner = {
    async run() {
      tasker.start()

      await tasker.run('Preparing nano-staged', async ({ update }) => {
        try {
          debug('Backing up original state...')
          await git.diff_patch(patch_original)
          root.partially_staged = await git.status_name(
            ({ x, y }) => 'AMRC'.includes(x) && 'ACMRD'.includes(y)
          )
          debug('Done backing up original state!')
        } catch (e) {
          root.skip_all = true
          root.errors.push(e)
          update({ state: 'error' })
        }
      })

      if (!root.skip_all && should_backup && root.partially_staged.length > 0) {
        await tasker.run('Backing up unstaged changes for staged files', async ({ update }) => {
          try {
            debug('Backing up usntaged files...')
            await git.diff_patch(patch_unstaged, root.partially_staged)
            await git.checkout(root.partially_staged)
            debug('Done backing up usntaged files!')
          } catch (e) {
            root.revert = true
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!root.skip_all && !root.revert) {
        async function run_task({ pattern, files, commands }, tasker) {
          let skipped = false
          let sub_tasks = []

          await tasker.group(async (tasker) => {
            for (const cmd of to_array(commands)) {
              const is_fn = typeof cmd === 'function'
              const commands = is_fn ? await cmd({ filenames: files, type }) : cmd

              for (const command of to_array(commands)) {
                const [cmd, ...args] = str_argv_to_array(command)

                debug('cmd:', cmd)
                debug('args:', args)

                sub_tasks.push(
                  tasker.run(command, async ({ update, set_error }) => {
                    if (skipped) {
                      update({ state: 'warning' })
                      return
                    }

                    try {
                      await executor(cmd, is_fn ? args : args.concat(files), {
                        cwd: /^git(\.exe)?/i.test(cmd) ? git_paths.root : cwd,
                      })
                    } catch (e) {
                      skipped = true

                      let error = (e.message || e).trim()
                      let msg = error ? '\n' + error : ''
                      let fail = c.inverse(c.bold(c.red(` FAIL `)))

                      set_error(`${fail} ${pattern} ${c.dim('>')} ${command}:${msg}`)
                      update({ title: c.red(command) })
                    }
                  })
                )
              }
            }

            return sub_tasks
          })

          const errors = sub_tasks.map(({ task }) => task.error).filter(Boolean)

          if (errors.length > 0) {
            throw errors
          }
        }

        async function run_tasks(tasks, tasker) {
          const result = await Promise.all(
            tasks.map((task) => {
              const { pattern, files } = task

              const count = files.length
              const count_title = `${count} ${count > 1 ? 'files' : 'file'}`
              const suffix = count > 0 ? count_title : `no files`
              const title = pattern + c.dim(` - ${suffix}`)

              return tasker.run(title, async ({ task: tasker, update, set_error }) => {
                if (count === 0) {
                  update({ state: 'warning' })
                  return
                }

                try {
                  await run_task(task, tasker)
                } catch (e) {
                  set_error(e)
                }
              })
            })
          )

          const errors = result.map(({ error }) => error).filter(Boolean)

          if (errors.length > 0) {
            throw errors
          }
        }

        await tasker.run(`Running tasks`, async ({ task: tasker, update }) => {
          try {
            const result = await Promise.all(
              runner.task_chunks.map((tasks, index) =>
                tasker.run(
                  `Running tasks for ${type} files - (chunk ${index + 1})`,
                  async ({ task: tasker, set_error }) => {
                    try {
                      await run_tasks(tasks, tasker)
                    } catch (e) {
                      set_error(e)
                    }
                  }
                )
              )
            )

            const errors = result
              .map(({ error }) => error)
              .filter(Boolean)
              .join('\n\n')

            if (errors) {
              throw new NanoStagedError({
                type: 'output',
                stream: 'stderr',
                data: errors + '\n',
              })
            }
          } catch (e) {
            root.revert = true
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!root.skip_all && !root.revert && should_backup) {
        await tasker.run(`Applying modifications from tasks`, async ({ update }) => {
          try {
            debug('Adding task modifications to index...')

            for (const chunk of split_in_chunks(matched_files, max_arg_length)) {
              await git.add(chunk)
            }

            if ((await git.diff_name([], { staged: true })).length === 0 && !allow_empty) {
              throw new NanoStagedError({ type: 'failure', reason: 'empty-git-commit' })
            }

            debug('Done adding task modifications to index!')
          } catch (e) {
            root.revert = true
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!root.skip_all && !root.revert && should_backup && root.partially_staged.length > 0) {
        await tasker.run(`Restoring unstaged changes for staged files`, async ({ update }) => {
          try {
            debug('Restoring unstaged changes...')
            await git.apply(patch_unstaged)
          } catch (apply_error) {
            debug('Error while restoring changes:')
            debug(apply_error)
            debug('Retrying with 3-way merge')

            try {
              await git.apply(patch_unstaged, true)
            } catch (three_way_apply_error) {
              debug('Error while restoring unstaged changes using 3-way merge:')
              debug(three_way_apply_error)

              root.errors.push(new NanoStagedError({ type: 'failure', reason: 'merge-conflict' }))
              update({ state: 'error' })
            }
          }
        })
      }

      if (!root.skip_all && root.revert) {
        await tasker.run(`Restoring to original state because of errors`, async ({ update }) => {
          try {
            debug('Restoring original state...')
            await git.checkout('.')

            if (has_patch(patch_original)) {
              await git.apply(patch_original)
            }

            debug('Done restoring original state!')
          } catch (e) {
            root.clear = false
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!root.skip_all && root.clear) {
        await tasker.run('Cleaning up temporary to patch files', async ({ update }) => {
          try {
            debug('Removing temp files...')
            if (has_patch(patch_original)) fs.unlinkSync(patch_original)
            if (has_patch(patch_unstaged)) fs.unlinkSync(patch_unstaged)
            debug('Done removing temp files!')
          } catch (e) {
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      tasker.stop()

      if (root.errors.length > 0) {
        throw root.errors
      }
    },
  }

  runner.task_chunks = file_chunks.map((file_chunk) => {
    const debug = create_debug('nano-staged:cmd-tasks')
    const tasks = []

    debug('Generating chunks tasks')

    for (const [pattern, commands] of Object.entries(config)) {
      const matches = globex(pattern, { extended: true, globstar: pattern.includes('/') })
      const task_files = []

      for (let file of file_chunk) {
        file = normalize(relative(cwd, file))

        if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
          continue
        }

        if (matches.test(file)) {
          file = normalize(resolve(cwd, file))

          matched_files.add(file)
          task_files.push(file)
        }
      }

      const task = { files: task_files, commands, pattern }
      debug('Generated task: \n%O', task)

      tasks.push(task)
    }

    return tasks
  })

  return runner
}
