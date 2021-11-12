import { toAbsolute, toRelative, spawn, findUp, toArray } from '../utils/index.js'
import { join } from 'path'

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

async function execGit(args, opts) {
  try {
    return await spawn('git', args, opts)
  } catch (err) {
    throw err
  }
}

export function gitWorker(opts = {}) {
  return {
    async diffPatch(patchPath) {
      await execGit(['diff', ...DIFF_ARGS, '--output', patchPath], opts)
    },

    async applyPatch(patchPath) {
      await execGit(['apply', ...APPLY_ARGS, patchPath], opts)
    },

    async checkPatch(patchPath) {
      try {
        await execGit(['apply', '--check', ...APPLY_ARGS, patchPath], opts)
        return true
      } catch (error) {
        return false
      }
    },

    async resolveDir(cwd = '') {
      let gitDir = findUp(cwd, '.git')
      let gitConfigDir = join(gitDir, '.git')

      return { gitDir, gitConfigDir }
    },

    async add(paths) {
      paths = toArray(paths)

      if (paths.length) {
        await execGit(['add', '-A', '--', ...paths], opts)
      }
    },

    async checkout(paths) {
      paths = toArray(paths)

      if (paths.length) {
        await execGit(['checkout', '-q', '--force', '--', ...paths], opts)
      }
    },

    async getStagedFiles({ gitDir, cwd }) {
      let entries = []

      try {
        let i = 0
        let lastIndex
        let raw = await execGit(['status', '-z'], opts)

        while (i < raw.length) {
          let code = raw.charCodeAt(i)

          switch (code) {
            case ADDED:
            case MODIFIED:
            case RENAMED:
            case COPIED: {
              let x = raw.charCodeAt(i++)
              let y = raw.charCodeAt(i++)
              let entry = {
                path: '',
                type: STAGED_CODE,
              }

              i++

              if (x === RENAMED || x === COPIED) {
                lastIndex = raw.indexOf('\0', i)

                if (!~lastIndex) {
                  return
                }

                entry.path = raw.substring(i, lastIndex)
                i = lastIndex + 1
              }

              lastIndex = raw.indexOf('\0', i)

              if (!~lastIndex) {
                return
              }

              entry.path = raw.substring(i, lastIndex)

              if (entry.path[entry.path.length - 1] !== '/') {
                if (y === ADDED || y === COPIED || y === MODIFIED || y === RENAMED) {
                  entry.type = CHANGED_CODE
                }

                if (y === DELETED) {
                  entry.type = DELETED_CODE
                }

                entry.path = toRelative(toAbsolute(entry.path, gitDir), cwd)
                entries.push(entry)
              }

              i = lastIndex + 1
              break
            }

            default: {
              lastIndex = raw.indexOf('\0', i)

              if (!~lastIndex) {
                return
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
}
