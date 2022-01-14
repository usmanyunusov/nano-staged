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

export function createGit(cwd = process.cwd()) {
  let git = {
    cwd,

    async exec(args = [], opts = {}) {
      try {
        return await spawner('git', args, {
          ...opts,
          cwd: opts.cwd || git.cwd,
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
      } catch (error) {
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

    async repoPath(opts = {}) {
      try {
        let result = await git.exec(['rev-parse', '--show-toplevel'], opts)
        return result ? normalize(result.trimLeft().replace(/[\r\n]+$/, '')) : ''
      } catch (err) {
        return ''
      }
    },

    async getRepoAndDotGitPaths(opts = {}) {
      try {
        let path = await git.repoPath(opts)

        return {
          repoPath: path || null,
          dotGitPath: path ? join(path, '.git') : null,
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

    fileGroup(entries = []) {
      let deleted = []
      let changed = []
      let working = []

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
    },

    async diffFiles(refs = [], opts = {}) {
      let [ref1, ref2] = refs
      let lines = await git.diffFileName(ref1, ref2, opts)
      let files = lines ? lines.replace(/\u0000$/, '').split('\u0000') : []
      let result = files.map((path) => ({ type: CHANGED_CODE, path, rename: undefined }))

      return git.fileGroup(result)
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

      return git.fileGroup(result)
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

      return git.fileGroup(result)
    },
  }

  return git
}
