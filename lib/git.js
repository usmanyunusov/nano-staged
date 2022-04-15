import { join, normalize, resolve } from 'path'
import fs from 'fs'

import { executor } from './executor.js'
import { toArray } from './utils.js'

const ADDED = 'A'.charCodeAt(0)
const COPIED = 'C'.charCodeAt(0)
const DELETED = 'D'.charCodeAt(0)
const MODIFIED = 'M'.charCodeAt(0)
const RENAMED = 'R'.charCodeAt(0)
const SPACE = ' '.charCodeAt(0)

export const STAGED_CODE = 1 << 0
export const CHANGED_CODE = 1 << 1
export const DELETED_CODE = 1 << 2

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
  const deleted = []
  const changed = []
  const working = []

  for (let { path, type, rename } of entries) {
    path = rename || path

    if (!working.includes(path)) {
      if (type === CHANGED_CODE) {
        changed.push(path)
      }

      if (type === DELETED_CODE) {
        deleted.push(path)
      }

      working.push(path)
    }
  }

  return { working, deleted, changed }
}

export function createGit(cwd = process.cwd()) {
  const git = {
    cwd,

    async exec(args = [], opts = {}) {
      try {
        return await executor('git', args, {
          ...opts,
          cwd: opts.cwd || git.cwd,
        })
      } catch (e) {
        throw e
      }
    },

    async diff(fileName, files = [], opts = {}) {
      const args = ['diff', ...DIFF_ARGS, '--output', fileName]

      if (files.length) {
        args.push('--')
        args.push(...files)
      }

      await git.exec(args, opts)
    },

    async diffFileName(ref1, ref2, opts = {}) {
      const args = ['diff', '--name-only', '--no-ext-diff', '--diff-filter=ACMR', '-z']

      if (ref1) {
        args.push(ref1)
      }
      if (ref2) {
        args.push(ref2)
      }

      try {
        return await git.exec([...args, '--'], opts)
      } catch {
        return ''
      }
    },

    async apply(patch, allowConflicts = false, opts = {}) {
      const args = ['apply', ...APPLY_ARGS]

      if (allowConflicts) {
        args.push('-3')
      }

      if (patch) {
        args.push(patch)
      }

      await git.exec(args, opts)
    },

    async getGitPaths(opts = {}) {
      const paths = {
        root: null,
        dot: null,
      }

      delete process.env.GIT_DIR
      delete process.env.GIT_WORK_TREE

      try {
        const line = await git.exec(['rev-parse', '--show-toplevel'], opts)
        const git_path = line ? normalize(line.trimLeft().replace(/[\r\n]+$/, '')) : ''
        const git_config_path = normalize(fs.realpathSync(join(git_path, '.git')))

        if (git_path) {
          paths.root = git_path
          paths.dot = git_config_path
        }

        if (fs.lstatSync(git_config_path).isFile()) {
          const file = fs.readFileSync(git_config_path, 'utf-8').toString()
          const path = resolve(git_path, file.replace(/^gitdir: /, '')).trim()
          paths.dot = path
        }

        return paths
      } catch {
        return paths
      }
    },

    async add(paths, opts = {}) {
      paths = toArray(paths)

      if (paths.length) {
        const args = ['add', '-A', '--', ...paths]
        await git.exec(args, opts)
      }
    },

    async checkout(paths, opts = {}) {
      paths = toArray(paths)

      if (paths.length) {
        const args = ['checkout', '-q', '--force', '--', ...paths]
        await git.exec(args, opts)
      }
    },

    async status(opts = {}) {
      const env = { GIT_OPTIONAL_LOCKS: '0' }
      const args = ['status', '-z', '-u']
      const result = []

      try {
        const raw = await git.exec(args, { env, ...opts })

        let i = 0
        let lastIndex

        while (i < raw.length) {
          if (i + 4 >= raw.length) {
            return []
          }

          const entry = {
            x: raw.charCodeAt(i++),
            y: raw.charCodeAt(i++),
            path: '',
            rename: undefined,
          }

          i++

          if (entry.x === RENAMED || entry.x === COPIED) {
            lastIndex = raw.indexOf('\0', i)

            if (!~lastIndex) {
              return []
            }

            entry.rename = raw.substring(i, lastIndex)
            i = lastIndex + 1
          }

          lastIndex = raw.indexOf('\0', i)

          if (!~lastIndex) {
            return []
          }

          entry.path = raw.substring(i, lastIndex)

          if (entry.path[entry.path.length - 1] !== '/') {
            result.push(entry)
          }

          i = lastIndex + 1
        }

        return result
      } catch {
        return []
      }
    },

    async changedFiles(refs = [], opts = {}) {
      const [ref1, ref2] = refs
      const lines = await git.diffFileName(ref1, ref2, opts)
      const files = lines ? lines.replace(/\u0000$/, '').split('\u0000') : []
      const result = files.map((path) => ({ type: CHANGED_CODE, path, rename: undefined }))

      return group(result)
    },

    async stagedFiles(opts = {}) {
      const entries = await git.status(opts)
      const result = []

      for (const entry of entries) {
        const { x, y } = entry

        if (x === ADDED || x === MODIFIED || x === RENAMED || x === COPIED) {
          if (y === ADDED || y === COPIED || y === MODIFIED || y === RENAMED) {
            entry.type = CHANGED_CODE
          } else if (y === DELETED) {
            entry.type = DELETED_CODE
          } else {
            entry.type = STAGED_CODE
          }

          result.push(entry)
        }
      }

      return group(result)
    },

    async unstagedFiles(opts = {}) {
      const entries = await git.status(opts)
      const result = []

      for (const entry of entries) {
        const { y } = entry

        if (y !== SPACE && y !== DELETED) {
          entry.type = CHANGED_CODE
          result.push(entry)
        }
      }

      return group(result)
    },
  }

  return git
}
