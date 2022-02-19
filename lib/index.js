import { getConfig, validConfig } from './config.js'
import { createReporter } from './reporter.js'
import { NanoStagedError } from './errors.js'
import { createRunner } from './runner.js'
import { createGit } from './git.js'
import { toArray } from './utils.js'

export default async function (options) {
  const opts = {
    stream: process.stderr,
    cwd: process.cwd(),
    allowEmpty: false,
    config: undefined,
    unstaged: false,
    diff: false,
    ...options,
  }

  const reporter = createReporter(opts.stream)
  const git = createGit(opts.cwd)

  try {
    const config = await getConfig(opts.cwd, opts.config)
    const git_paths = await git.getGitPaths()

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

    if (!git_paths.root) {
      throw new NanoStagedError('noGitRepo')
    }

    let files, type

    if (opts.unstaged) {
      files = await git.unstagedFiles({ cwd: git_paths.root })
      type = 'unstaged'
    } else if (opts.diff && Array.isArray(opts.diff)) {
      files = await git.changedFiles(opts.diff, { cwd: git_paths.root })
      type = 'diff'
    } else {
      files = await git.stagedFiles({ cwd: git_paths.root })
      type = 'staged'
    }

    if (!files.working.length) {
      reporter.error(new NanoStagedError('noFiles', type))
      return
    }

    await createRunner({ ...opts, config, git_paths, files, type }).run()
  } catch (errors) {
    for (const error of toArray(errors)) {
      reporter.error(error)
    }
    throw errors
  }
}
