import { join, normalize, resolve } from 'path'
import fs from 'fs'

import { create_debug } from './debug.js'
import { executor } from './executor.js'
import { to_array } from './utils.js'

const STAGED_CODE = 1 << 0
const CHANGED_CODE = 1 << 1
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

function group(entries = []) {
  const changed = []
  const working = []

  for (let { path, type, rename } of entries) {
    path = rename || path

    if (!working.includes(path)) {
      if (type === CHANGED_CODE) {
        changed.push(path)
      }

      working.push(path)
    }
  }

  return { working, changed }
}

export function create_git(cwd = process.cwd()) {
  const debug = create_debug('nano-staged:git')

  const git = {
    cwd,

    async exec(args = [], opts = {}) {
      debug('Running git command', args)

      try {
        return await executor('git', NO_SUBMODULE_RECURSE.concat(args), {
          ...opts,
          cwd: opts.cwd || git.cwd,
        })
      } catch (e) {
        throw e
      }
    },

    async diff(fileName, files = [], opts = {}) {
      const args = ['diff', ...DIFF_ARGS, '--output', fileName]

      if (files.length) args.push('--', ...files)

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
        const cdup = await git.exec(['rev-parse', '--show-cdup'], opts)
        const git_root = cdup ? normalize(resolve(cwd, cdup.trim())) : cwd
        const git_config_path = normalize(fs.realpathSync(join(git_root, '.git')))

        git_root && (paths.root = git_root)
        git_config_path && (paths.dot = git_config_path)

        if (paths.dot && fs.lstatSync(paths.dot).isFile()) {
          const file = fs.readFileSync(paths.dot, 'utf-8').toString()
          const path = resolve(git_root, file.replace(/^gitdir: /, '')).trim()
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

    async diff_file_name([ref1, ref2], opts = {}) {
      const args = ['diff', '--name-only', '--no-ext-diff', '--diff-filter=ACMR', '-z']

      if (ref1) args.push(ref1)
      if (ref2) args.push(ref2)

      try {
        const raw = await git.exec([...args, '--'], opts)
        const files = raw ? raw.replace(/\u0000$/, '').split('\u0000') : []
        const result = files.map((path) => ({ type: CHANGED_CODE, path, rename: undefined }))

        return result
      } catch {
        return []
      }
    },

    async status(opts = {}, type = 'staged') {
      const env = { GIT_OPTIONAL_LOCKS: '0' }
      const args = ['status', '-z', '-u']
      const result = []

      const resolve_path = (path) => path && normalize(resolve(opts.cwd || git.cwd, path))
      const renamed_path = (path) => (/\x00/.test(path) ? path.split(/\x00/) : [undefined, path])

      try {
        const raw = await git.exec(args, { ...opts, env: { ...opts.env, env } })
        const lines = raw.split(/\x00(?=[ AMDRC?!]{2} |$)/).filter(Boolean)

        for (const line of lines) {
          let [to, from] = renamed_path(line.substr(3))
          let [x, y] = line

          if (type === 'staged') {
            if (['A', 'M', 'R', 'C'].includes(x)) {
              result.push({
                type: ['A', 'C', 'M', 'R', 'D'].includes(y) ? CHANGED_CODE : STAGED_CODE,
                rename: resolve_path(to),
                path: resolve_path(from),
              })
            }
          } else if (type === 'unstaged') {
            if (![' ', 'D'].includes(y)) {
              result.push({
                type: CHANGED_CODE,
                rename: resolve_path(to),
                path: resolve_path(from),
              })
            }
          }
        }

        return result
      } catch {
        return []
      }
    },

    async changed_files(refs = [], opts = {}) {
      const result = await git.diff_file_name(refs, opts)
      return group(result)
    },

    async staged_files(opts = {}) {
      const result = await git.status(opts, 'staged')
      return group(result)
    },

    async unstaged_files(opts = {}) {
      const result = await git.status(opts, 'unstaged')
      return group(result)
    },
  }

  return git
}
