import * as p from 'path'
import * as fs from 'fs'

import { to_array, normalize } from './utils.js'
import { create_debug } from './debug.js'
import { executor } from './executor.js'

const NO_SUBMODULE_RECURSE = ['-c', 'submodule.recurse=false']
const APPLY_ARGS = ['-v', '--whitespace=nowarn', '--recount', '--unidiff-zero']
const DIFF_ARGS = [
  '--binary',
  '--unified=0',
  '--no-color',
  '--no-ext-diff',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--patch',
  '--submodule=short',
]

const renamed_path = (path) => (/\x00/.test(path) ? path.split(/\x00/) : [undefined, path])
const debug = create_debug('nano-staged:git')

export function create_git(cwd = process.cwd()) {
  const git = {
    async exec(args = [], opts = {}) {
      debug('Running git command', args)

      try {
        return await executor('git', NO_SUBMODULE_RECURSE.concat(args), {
          ...opts,
          cwd: opts.cwd || cwd,
        })
      } catch (e) {
        throw e
      }
    },

    async add(paths, opts = {}) {
      paths = to_array(paths)

      if (paths.length) {
        const args = ['add', '-A', '--', ...paths]
        await git.exec(args, opts)
      }
    },

    async checkout(paths, opts = {}) {
      paths = to_array(paths)

      if (paths.length) {
        const args = ['checkout', '-q', '--force', '--', ...paths]
        await git.exec(args, opts)
      }
    },

    async status(opts = {}) {
      const env = { GIT_OPTIONAL_LOCKS: '0' }
      const args = ['status', '-z', '-u']

      try {
        return await git.exec(args, { ...opts, env: { ...opts.env, env } })
      } catch {
        return ''
      }
    },

    async diff_name([ref1, ref2], opts = {}) {
      const args = ['diff', '--name-only', '--no-ext-diff', '-z']

      if (opts.staged) {
        args.push('--staged')
      }

      if (opts.filter != null && opts.filter.length > 0) {
        args.push(`--diff-filter=${opts.filter.trim()}`)
      }

      if (ref1) args.push(ref1)
      if (ref2) args.push(ref2)

      try {
        const raw = await git.exec(args, opts)
        const files = raw ? raw.replace(/\u0000$/, '').split('\u0000') : []

        return files.map((file) => normalize(p.resolve(opts.cwd || cwd, file)))
      } catch {
        return []
      }
    },

    async diff_patch(file_name, files = [], opts = {}) {
      const args = ['diff', ...DIFF_ARGS, '--output', file_name]

      if (files.length) {
        args.push('--', ...files)
      }

      await git.exec(args, opts)
    },

    async apply(patch, allowConflicts = false, opts = {}) {
      const args = ['apply', ...APPLY_ARGS]

      if (allowConflicts) args.push('-3')
      if (patch) args.push(patch)

      await git.exec(args, opts)
    },

    async paths(opts = {}) {
      const paths = {
        root: null,
        dot: null,
      }

      delete process.env.GIT_DIR
      delete process.env.GIT_WORK_TREE

      try {
        const cd_up = await git.exec(['rev-parse', '--show-cdup'], opts)
        const git_root = cd_up
          ? normalize(p.resolve(opts.cwd || cwd, cd_up.trim()))
          : opts.cwd || cwd
        const git_config_path = normalize(fs.realpathSync(p.join(git_root, '.git')))

        git_root && (paths.root = git_root)
        git_config_path && (paths.dot = git_config_path)

        if (paths.dot && fs.lstatSync(paths.dot).isFile()) {
          const file = fs.readFileSync(paths.dot, 'utf-8').toString()
          const path = p.resolve(git_root, file.replace(/^gitdir: /, '')).trim()
          paths.dot = path
        }

        debug('Resolved git directory to be `%s`', paths.root)
        debug('Resolved git config directory to be `%s`', paths.dot)

        return paths
      } catch (err) {
        debug('Failed to resolve git repo with error:', err)
        return paths
      }
    },

    async status_name(filtered = () => true, opts = {}) {
      const status = await git.status(opts)
      const result = status
        .split(/\x00(?=[ AMDRCU?!]{2} |$)/)
        .filter(Boolean)
        .map((line) => {
          const [to, from] = renamed_path(line.substring(3))
          const [x, y] = line.substring(0, 2)
          const name = normalize(p.resolve(opts.cwd || cwd, to || from))

          return { x, y, name }
        })
        .filter(filtered)
        .map(({ name }) => name)

      debug('Found status filtered files', result)

      return result
    },
  }

  return git
}
