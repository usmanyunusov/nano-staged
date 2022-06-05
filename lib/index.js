import path from 'path'

import { get_config, valid_config } from './config.js'
import { to_array, split_in_chunks } from './utils.js'
import { NanoStagedError } from './error.js'
import { create_logger } from './logger.js'
import { create_runner } from './runner.js'
import { create_debug } from './debug.js'
import { create_git } from './git.js'
import c from './colors.js'

const DIVIDER = c.red(c.dim('⎯'.repeat(process.stdout.columns || 30)))

const MAX_CLI_LENGTH = (() => {
  if (process.platform === 'darwin') return 262144
  if (process.platform === 'win32') return 8191
  return 131072
})()

export default async function (options) {
  const opts = {
    max_arg_length: MAX_CLI_LENGTH / 2,
    stream: process.stderr,
    diff_filter: undefined,
    allow_empty: false,
    config: undefined,
    unstaged: false,
    diff: undefined,
    ...options,
  }

  const debug = create_debug('nano-staged:index')
  debug('Running all scripts with options `%s`', opts)

  opts.cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd()
  debug('Using working directory `%s`', opts.cwd)

  const logger = create_logger(opts.stream)
  const git = create_git(opts.cwd)

  try {
    const git_paths = await git.paths()

    if (!git_paths.root) {
      throw new NanoStagedError({ type: 'failure', reason: 'no-git-repo' })
    }

    const config = await get_config(opts.cwd, opts.config)

    if (!config) {
      throw new NanoStagedError(
        typeof opts.config === 'string'
          ? { type: 'failure', reason: 'no-file-config', file: opts.config }
          : { type: 'failure', reason: 'no-config' }
      )
    }

    if (!valid_config(config)) {
      throw new NanoStagedError({ type: 'failure', reason: 'invalid-config' })
    }

    const type = opts.unstaged ? 'unstaged' : opts.diff ? 'diff' : 'staged'
    const files = opts.unstaged
      ? await git.status_name({ cwd: git_paths.root }, (entities) =>
          entities.filter(({ y }) => !'D '.includes(y)).map(({ name }) => name)
        )
      : await git.diff_name(opts.diff || [], {
          staged: !opts.diff,
          filter: opts.diff_filter || 'ACMR',
          cwd: git_paths.root,
        })

    debug(`Loaded list of ${type} files in git:\n%O`, files)

    if (!files.length) {
      logger.log({ type: 'info', detail: 'no-files', runner_type: type })
      return
    }

    const file_chunks = [...split_in_chunks(files, opts.max_arg_length)]

    const runner = create_runner({
      ...opts,
      file_chunks,
      git_paths,
      config,
      type,
    })

    if (!runner.task_chunks.some((tasks) => tasks.some(({ files }) => files.length > 0))) {
      logger.log({ type: 'info', detail: 'no-matching-files' })
      return
    }

    await runner.run()
    debug('Tasks were executed successfully!')
  } catch (errors) {
    console.log(DIVIDER)

    for (const e of to_array(errors)) {
      if (e instanceof NanoStagedError) {
        logger.log(e.event)
      } else {
        console.error(`Unexpected error: ${e.toString()}`)
        console.error(e.stack)
      }
    }

    console.log(DIVIDER)
    throw errors
  }
}
