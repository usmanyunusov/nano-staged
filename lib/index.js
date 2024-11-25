import * as p from 'path'

import { NanoStagedError } from './error.js'
import { create_runner } from './runner.js'
import { create_debug } from './debug.js'
import { create_tasks } from './tasks.js'
import { create_git } from './git.js'
import { to_array } from './utils.js'
import * as config from './config.js'
import { log } from './log.js'
import c from './colors.js'

const DIVIDER = c.red(c.dim('⎯'.repeat(process.stdout.columns || 30)))
const MAX_CLI_LENGTH = (() => {
  if (process.platform === 'darwin') return 262144
  if (process.platform === 'win32') return 8191
  return 131072
})()

const debug = create_debug('nano-staged:index')

export default async function (options) {
  const opts = {
    max_arg_length: MAX_CLI_LENGTH / 2,
    stream: process.stderr,
    allow_empty: false,
    unstaged: false,
    shell: false,
    ...options,
  }

  debug('Running all scripts with options `%s`', opts)

  opts.cwd_is_explicit = !!opts.cwd
  opts.cwd = opts.cwd_is_explicit ? p.resolve(opts.cwd) : process.cwd()
  debug('Using working directory `%s`', opts.cwd)

  try {
    const type = opts.unstaged ? 'unstaged' : opts.diff ? 'diff' : 'staged'
    const git = create_git(opts.cwd)
    const git_paths = await git.paths()

    if (!git_paths.root) {
      throw new NanoStagedError({ type: 'failure', reason: 'no-git-repo' })
    }

    const files = opts.unstaged
      ? await git.status_name(({ y }) => !'D '.includes(y), {
          cwd: git_paths.root,
        })
      : await git.diff_name(opts.diff || [], {
          staged: !opts.diff,
          filter: opts.diff_filter || 'ACMR',
          cwd: git_paths.root,
        })

    debug(`Loaded list of ${type} files in git:\n%O`, files)

    if (!files.length) {
      return log({ type: 'info', detail: 'no-files', runner_type: type })
    }

    const configs = await config.search({
      search_dirs: [...files.reduce((set, file) => set.add(p.dirname(file)), new Set())],
      config_path: opts.config_path,
      config_obj: opts.config,
      cwd: opts.cwd,
    })

    if (Object.keys(configs).length === 0) {
      throw new NanoStagedError(
        opts.config_path
          ? { type: 'failure', reason: 'no-path-config', path: opts.config_path }
          : { type: 'failure', reason: 'no-config' }
      )
    }

    for (const [path, current_config] of Object.entries(configs)) {
      if (!config.validate(current_config)) {
        throw new NanoStagedError({ type: 'failure', reason: 'invalid-config', path })
      }
    }

    const files_by_config = config.group_files({
      is_single: opts.config || opts.config_path !== undefined,
      configs,
      files,
    })

    const { config_tasks, matched_files } = create_tasks({ ...opts, files_by_config })

    if (!config_tasks.some(({ tasks }) => tasks.some(({ files }) => files.length > 0))) {
      return log({ type: 'info', detail: 'no-matching-files' })
    }

    await create_runner({
      ...opts,
      matched_files,
      config_tasks,
      git_paths,
      type,
    }).run()

    debug('Tasks were executed successfully!')
  } catch (errors) {
    console.log(DIVIDER)

    for (const e of to_array(errors)) {
      if (e instanceof NanoStagedError) {
        log(e.event)
      } else {
        console.error(`Unexpected error: ${e.toString()}`)
        console.error(e.stack)
      }
    }

    console.log(DIVIDER)
    throw errors
  }
}
