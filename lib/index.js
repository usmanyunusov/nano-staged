import { getConfig, validConfig } from './config.js'
import { createReporter } from './reporter.js'
import { NanoStagedError } from './errors.js'
import { createRunner } from './runner.js'
import { createGit } from './git.js'
import { toArray } from './utils.js'

const optionsDefault = {
  stream: process.stderr,
  cwd: process.cwd(),
  allowEmpty: false,
  config: undefined,
  unstaged: false,
  diff: false,
}

export default async function (options) {
  const opts = { ...optionsDefault, ...options }
  const reporter = createReporter(opts.stream)
  const git = createGit(opts.cwd)

  try {
    const config = await getConfig(opts.cwd, opts.config)

    if (!config) {
      if (typeof opts.config === 'string') {
        throw new NanoStagedError('noFileConfig', opts.config)
      } else {
        throw new NanoStagedError('noConfig')
      }
    }

    if (!validConfig(config)) {
      throw new NanoStagedError('invalidConfig')
    }

    opts.git_paths = await git.getGitPaths()

    if (!opts.git_paths.root) {
      throw new NanoStagedError('noGitRepo')
    }

    if (opts.unstaged) {
      opts.files = await git.unstagedFiles({ cwd: opts.git_paths.root })
      opts.type = 'unstaged'
    } else if (opts.diff && Array.isArray(opts.diff)) {
      opts.files = await git.changedFiles(opts.diff, { cwd: opts.git_paths.root })
      opts.type = 'diff'
    } else {
      opts.files = await git.stagedFiles({ cwd: opts.git_paths.root })
      opts.type = 'staged'
    }

    if (!opts.files.working.length) {
      reporter.error(new NanoStagedError('noFiles', opts.type))
      return
    }

    await createRunner({ ...opts, config }).run()
  } catch (errors) {
    for (const error of toArray(errors)) {
      reporter.error(error)
    }
    throw errors
  }
}
