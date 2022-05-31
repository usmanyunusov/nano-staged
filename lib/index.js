import path from 'path'

import { get_config, valid_config } from './config.js'
import { NanoStagedError } from './error.js'
import { create_logger } from './logger.js'
import { create_runner } from './runner.js'
import { create_debug } from './debug.js'
import { create_git } from './git.js'
import { to_array } from './utils.js'
import c from './colors.js'

const DIVIDER = c.red(c.dim('⎯'.repeat(process.stdout.columns || 30)))

export default async function (options) {
  const opts = {
    stream: process.stderr,
    diff_filter: undefined,
    allowEmpty: false,
    config: undefined,
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

    let type = opts.diff ? 'diff' : 'staged'
    let files = await git.diff_name(opts.diff || [], {
      staged: !opts.diff,
      filter: opts.diff_filter || 'ACMR',
      cwd: git_paths.root,
    })

    debug(`Loaded list of ${type} files in git:\n%O`, files)

    if (!files.length) {
      logger.log({ type: 'info', detail: 'no-files', runner_type: type })
      return
    }

    const runner = create_runner({
      ...opts,
      git_paths,
      config,
      files,
      type,
    })

    if (!runner.cmd_tasks.some(({ files }) => files.length > 0)) {
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
