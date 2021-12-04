import { join, normalize } from 'path'

import { spawner } from './spawner.js'
import { toArray } from './utils.js'

const ADDED = 'A'.charCodeAt(0)
const COPIED = 'C'.charCodeAt(0)
const DELETED = 'D'.charCodeAt(0)
const MODIFIED = 'M'.charCodeAt(0)
const RENAMED = 'R'.charCodeAt(0)

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

    async diffPatch(patchPath, files = [], opts = {}) {
      const args = ['diff', ...DIFF_ARGS, '--output', patchPath]

      if (files.length) {
        args.push('--')
        args.push(...files)
      }

      await git.exec(args, opts)
    },

    async applyPatch(patchPath, threeWay = false, opts = {}) {
      const args = ['apply', ...APPLY_ARGS]

      if (threeWay) {
        args.push('--3way')
      }

      if (patchPath) {
        args.push(patchPath)
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

    async getStagedFiles(opts = {}) {
      const args = ['status', '-z', '-u']
      const entries = []

      try {
        let i = 0
        let lastIndex
        let raw = await git.exec(args, opts)

        while (i < raw.length) {
          let code = raw.charCodeAt(i)

          if (i + 4 >= raw.length) {
            return []
          }

          switch (code) {
            case ADDED:
            case MODIFIED:
            case RENAMED:
            case COPIED: {
              let x = raw.charCodeAt(i++)
              let y = raw.charCodeAt(i++)
              let entry = {
                path: '',
                rename: undefined,
                type: STAGED_CODE,
              }

              i++

              if (x === RENAMED || x === COPIED) {
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
                if (y === ADDED || y === COPIED || y === MODIFIED || y === RENAMED) {
                  entry.type = CHANGED_CODE
                }

                if (y === DELETED) {
                  entry.type = DELETED_CODE
                }

                entries.push(entry)
              }

              i = lastIndex + 1
              break
            }

            default: {
              lastIndex = raw.indexOf('\0', i)

              if (!~lastIndex) {
                return []
              }

              i = lastIndex + 1
              break
            }
          }
        }

        return entries
      } catch (err) {
        return entries
      }
    },
  }

  return git
}
