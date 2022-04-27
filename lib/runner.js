import { normalize, relative, resolve, isAbsolute } from 'path'
import fs from 'fs'

import { str_argv_to_array, to_array } from './utils.js'
import { create_renderer } from './renderer.js'
import { NanoStagedError } from './error.js'
import { create_debug } from './debug.js'
import { executor } from './executor.js'
import { create_task } from './task.js'
import { create_git } from './git.js'
import { globex } from './globex.js'
import c from './colors.js'

async function create_cmd_tasks({ cwd, config, files }) {
  const debug = create_debug('nano-staged:cmd-tasks')
  const cmd_tasks = []

  debug('Generating cmd tasks')

  for (const [pattern, commands] of Object.entries(config)) {
    const matches = globex(pattern, { extended: true, globstar: pattern.includes('/') })
    const task_files = []

    for (let file of files) {
      file = normalize(relative(cwd, file))

      if (!pattern.startsWith('../') && (file.startsWith('..') || isAbsolute(file))) {
        continue
      }

      if (matches.test(file)) {
        task_files.push(normalize(resolve(cwd, file)))
      }
    }

    const task = {
      files: task_files,
      commands,
      pattern,
    }

    debug('Generated task: \n%O', task)

    cmd_tasks.push(task)
  }

  return cmd_tasks
}

export async function create_runner({ allowEmpty, git_paths, stream, config, files, type, cwd }) {
  const root = {
    skip_all: false,
    revert: false,
    clear: true,
    errors: [],
    children: [],
  }

  const patch_unstaged = resolve(git_paths.dot, './nano-staged_partial.patch')
  const patch_original = resolve(git_paths.dot, './nano-staged.patch')

  const debug = create_debug('nano-staged:runner')
  const git = create_git(git_paths.root)

  const renderer = create_renderer(root, {
    isTTY: !create_debug.enabled && !process.env.CI,
    stream,
  })
  const task = create_task(root, renderer)

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
      renderer.start()

      await task('Preparing nano-staged', async ({ update }) => {
        try {
          debug('Backing up original state...')
          await git.diff(patch_original)
          debug('Done backing up original state!')
        } catch (e) {
          root.skip_all = true
          root.errors.push(e)
          update({ state: 'error' })
        }
      })

      if (!root.skip_all && type !== 'unstaged' && type !== 'diff' && files.changed.length > 0) {
        await task('Backing up unstaged changes for staged files', async ({ update }) => {
          try {
            debug('Backing up usntaged files...')
            await git.diff(patch_unstaged, files.changed)
            await git.checkout(files.changed)
            debug('Done backing up usntaged files!')
          } catch (e) {
            root.revert = true
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!root.skip_all && !root.revert) {
        await task(`Running tasks for ${type} files`, async ({ task, update }) => {
          try {
            let errors = []

            await Promise.all(
              runner.cmd_tasks.map(({ pattern, files, commands }) => {
                let count = files.length
                let suffix = count > 0 ? `${count} ${count > 1 ? 'files' : 'file'}` : `no files`
                let title = pattern + c.dim(` - ${suffix}`)

                return task(title, async ({ task, update }) => {
                  if (count === 0) {
                    update({ state: 'warning' })
                    return
                  }

                  try {
                    let skipped = false
                    let errors = []

                    await task.group(async (task) => {
                      let sub_tasks = []

                      for (const cmd of to_array(commands)) {
                        const is_fn = typeof cmd === 'function'
                        const commands = is_fn ? await cmd({ filenames: files, type }) : cmd

                        for (const command of to_array(commands)) {
                          const [cmd, ...args] = str_argv_to_array(command)

                          debug('cmd:', cmd)
                          debug('args:', args)

                          sub_tasks.push(
                            task(command, async ({ update }) => {
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
                                update({ title: c.red(command), state: 'error' })

                                let error = e.trim()
                                let msg = error ? '\n' + error : ''
                                let fail = c.inverse(c.bold(c.red(` FAIL `)))

                                errors.push(`${fail} ${pattern} ${c.dim('>')} ${command}:${msg}`)
                              }
                            })
                          )
                        }
                      }

                      return sub_tasks
                    })

                    if (errors.length > 0) {
                      throw errors.join('\n')
                    }
                  } catch (e) {
                    update({ state: 'error' })
                    errors.push(e + '\n')
                  }
                })
              })
            )

            if (errors.length) {
              throw new NanoStagedError({
                type: 'output',
                stream: 'stderr',
                data: errors.join('\n'),
              })
            }
          } catch (e) {
            root.revert = true
            root.errors.push(e)
            update({ state: 'error' })
          }
        })
      }

      if (!root.skip_all && !root.revert && type !== 'unstaged' && type !== 'diff') {
        await task(`Applying modifications from tasks`, async ({ update }) => {
          try {
            debug('Adding task modifications to index...')
            await git.add(files.working)

            if ((await git.staged_files()).working.length === 0 && !allowEmpty) {
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

      if (
        !root.skip_all &&
        !root.revert &&
        type !== 'unstaged' &&
        type !== 'diff' &&
        files.changed.length > 0
      ) {
        await task(`Restoring unstaged changes for staged files`, async ({ update }) => {
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
        await task(`Restoring to original state because of errors`, async ({ update }) => {
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
        await task('Cleaning up temporary to patch files', async ({ update }) => {
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

      renderer.stop()

      if (root.errors.length > 0) {
        throw root.errors
      }
    },
  }

  runner.cmd_tasks = await create_cmd_tasks({
    files: files.working,
    config,
    cwd,
  })

  return runner
}
