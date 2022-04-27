import * as p from 'path'
import * as fs from 'fs'

import { to_array, split_in_chunks, str_argv_to_array, normalize } from './utils.js'
import { executor, executor_cmds } from './executor.js'
import { create_spinner } from './spinner.js'
import { NanoStagedError } from './error.js'
import { create_debug } from './debug.js'
import { create_git } from './git.js'
import c from './colors.js'

const debug = create_debug('nano-staged:runner')

export function create_runner({
  max_arg_length,
  matched_files,
  config_tasks,
  allow_empty,
  git_paths,
  stream,
  shell,
  type,
  cwd,
}) {
  const git = create_git(git_paths.root)

  const patch_unstaged = p.resolve(git_paths.dot, './nano-staged_partial.patch')
  const patch_original = p.resolve(git_paths.dot, './nano-staged.patch')

  const should_backup = type !== 'diff' && type !== 'unstaged'
  const root = { skip_all: false, revert: false, clear: true, errors: [], children: [] }

  const is_tty = !('NS_DEBUG' in process.env) && !process.env.CI && process.env.TERM !== 'dumb'
  const spinner = create_spinner(root, { is_tty, stream })

  const has_patch = (path) => {
    debug('Reading patch `%s`', path)

    try {
      const buffer = path && fs.readFileSync(path)
      return buffer && buffer.toString() ? true : false
    } catch {
      return false
    }
  }

  const run_task = async ({ pattern, files, commands }, spinner) => {
    const task_group = []

    await spinner.group(async (spinner) => {
      for (const cmd of to_array(commands)) {
        const is_fn = typeof cmd === 'function'
        const commands = is_fn ? await cmd({ filenames: files, type }) : cmd

        for (const command of to_array(commands)) {
          const [cmd, ...args] = str_argv_to_array(command)

          debug('cmd:', cmd)
          debug('args:', args)

          task_group.push(
            spinner(command, async ({ update }) => {
              if (spinner.skip) {
                update({ state: 'warning' })
                return
              }

              try {
                const options = {
                  cwd: /^git(\.exe)?/i.test(cmd) ? git_paths.root : cwd,
                  shell,
                }

                if (shell) {
                  await executor_cmds(is_fn ? command : `${command} ${files.join(' ')}`, options)
                } else {
                  await executor(cmd, is_fn ? args : args.concat(files), options)
                }
              } catch (e) {
                spinner.skip = true

                let error = (e.message || e).trim()
                let msg = error ? '\n' + error : ''
                let fail = c.inverse(c.bold(c.red(` FAIL `)))

                update({ title: c.red(command) })
                throw `${fail} ${c.red(pattern)} ${c.dim('>')} ${c.red(command)}:${msg}`
              }
            })
          )
        }
      }

      return task_group
    })

    return task_group.map(({ task }) => task.error).filter(Boolean)
  }

  const run_tasks = async (tasks, spinner) => {
    const result = await Promise.all(
      tasks.map((task) => {
        const count = task.files.length
        const count_title = `${count} ${count > 1 ? 'files' : 'file'}`
        const suffix = count > 0 ? count_title : `no files`
        const title = task.pattern + c.dim(` - ${suffix}`)

        return spinner(title, async ({ spinner, update }) => {
          if (count === 0) {
            update({ state: 'warning' })
            return
          }

          await run_task(task, spinner).then((errors) => {
            if (errors.length > 0) {
              throw errors
            }
          })
        })
      })
    )

    return result
      .map(({ error }) => error)
      .filter(Boolean)
      .join('\n\n')
  }

  const handle_error = (e) => {
    root.errors.push(e)
    throw e
  }

  const runner = {
    async run() {
      spinner.start()

      await spinner('Preparing nano-staged...', async () => {
        try {
          debug('Backing up original state...')
          await git.diff_patch(patch_original)
          root.partially_staged = await git.status_name(
            ({ x, y }) => 'AMRC'.includes(x) && 'ACMRD'.includes(y)
          )
          debug('Done backing up original state!')
        } catch (e) {
          root.skip_all = true
          handle_error(e)
        }
      })

      if (!root.skip_all && should_backup && root.partially_staged.length > 0) {
        await spinner('Backing up unstaged changes for staged files...', async () => {
          try {
            debug('Backing up usntaged files...')
            await git.diff_patch(patch_unstaged, root.partially_staged)
            await git.checkout(root.partially_staged)
            debug('Done backing up usntaged files!')
          } catch (e) {
            root.revert = true
            handle_error(e)
          }
        })
      }

      if (!root.skip_all && !root.revert) {
        await spinner(`Running tasks for ${type} files...`, async ({ spinner, update }) => {
          try {
            const result = await Promise.all(
              config_tasks.map(({ index, path, tasks, files, chunks_len }) => {
                const config_name = path ? normalize(p.relative(cwd, path)) : 'Config object'
                const skipped = tasks.every(({ files }) => files.length === 0)
                const files_title = `${files.length} ${files.length > 1 ? 'files' : 'file'}`
                const suffix = skipped ? 'no tasks to run' : files_title
                const chunk_title = chunks_len > 1 ? `(chunk ${index + 1}/${chunks_len})...` : ''
                const title = config_name + c.dim(` - ${suffix} ${skipped ? '' : chunk_title}`)

                return spinner(title, async ({ spinner, update }) => {
                  if (skipped) {
                    update({ state: 'warning' })
                    return
                  }

                  await run_tasks(tasks, spinner).then((errors) => {
                    if (errors.length > 0) {
                      throw errors
                    }
                  })
                })
              })
            )

            const errors = result.map(({ error }) => error).filter(Boolean)

            if (errors.length > 0) {
              throw new NanoStagedError({
                type: 'output',
                stream: 'stderr',
                data: errors.join('\n\n') + '\n',
              })
            }
          } catch (e) {
            root.revert = true
            handle_error(e)
          }
        })
      }

      if (!root.skip_all && !root.revert && should_backup) {
        await spinner(`Applying modifications from tasks...`, async () => {
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
            handle_error(e)
          }
        })
      }

      if (!root.skip_all && !root.revert && should_backup && root.partially_staged.length > 0) {
        await spinner(`Restoring unstaged changes for staged files...`, async () => {
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
              handle_error(new NanoStagedError({ type: 'failure', reason: 'merge-conflict' }))
            }
          }
        })
      }

      if (!root.skip_all && root.revert) {
        await spinner(`Restoring to original state because of errors...`, async () => {
          try {
            debug('Restoring original state...')
            await git.checkout('.')

            if (has_patch(patch_original)) {
              await git.apply(patch_original)
            }
            debug('Done restoring original state!')
          } catch (e) {
            root.clear = false
            handle_error(e)
          }
        })
      }

      if (!root.skip_all && root.clear) {
        await spinner('Cleaning up temporary to patch files...', async () => {
          try {
            debug('Removing temp files...')
            if (has_patch(patch_original)) fs.unlinkSync(patch_original)
            if (has_patch(patch_unstaged)) fs.unlinkSync(patch_unstaged)
            debug('Done removing temp files!')
          } catch (e) {
            handle_error(e)
          }
        })
      }

      spinner.stop()

      if (root.errors.length > 0) {
        throw root.errors
      }
    },
  }

  return runner
}
