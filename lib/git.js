import { join, normalize } from 'path'

import { spawner } from './spawner.js'
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

export function gitWorker(cwd = process.cwd()) {
  let git = {
    async exec(args = [], opts = {}) {
      try {
        return await spawner('git', args, {
          ...opts,
          cwd: opts.cwd || cwd,
        })
      } catch (err) {
        throw err
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

    async getRepoAndDotGitPaths(opts = {}) {
      try {
        let result = await git.exec(['rev-parse', '--show-toplevel'], opts)
        let repositoriyPath = result ? normalize(result.trimLeft().replace(/[\r\n]+$/, '')) : ''

        return {
          repoPath: repositoriyPath || null,
          dotGitPath: repositoriyPath ? join(repositoriyPath, '.git') : null,
        }
      } catch (error) {
        return {
          repoPath: null,
          dotGitPath: null,
        }
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
        let i = 0
        let lastIndex
        let raw = await git.exec(args, { env, ...opts })

        while (i < raw.length) {
          if (i + 4 >= raw.length) {
            return []
          }

          let entry = {
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
      } catch (err) {
        return []
      }
    },

    async stagedFiles(opts = {}) {
      let entries = await git.status(opts)
      let result = []

      for (let entry of entries) {
        let { x, y } = entry

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

      return result
    },

    async unstagedFiles(opts = {}) {
      let entries = await git.status(opts)
      let result = []

      for (let entry of entries) {
        let { y } = entry

        if (y !== SPACE && y !== DELETED) {
          entry.type = CHANGED_CODE
          result.push(entry)
        }
      }

      return result
    },
  }

  return git
}
