import { toAbsolute, toRelative, git, findUp } from '../utils/index.js'

const STASH_MESSAGE = 'Nano Staged backup'
const ADDED = 'A'.charCodeAt(0)
const COPIED = 'C'.charCodeAt(0)
const DELETED = 'D'.charCodeAt(0)
const MODIFIED = 'M'.charCodeAt(0)
const RENAMED = 'R'.charCodeAt(0)

export const STAGED_CODE = 1 << 0
export const CHANGED_CODE = 1 << 1
export const DELETED_CODE = 1 << 2

export async function gitResetHard() {
  await git(['reset', '--hard', 'HEAD'])
}

export async function gitDropStash() {
  await git(['stash', 'drop', '-q', await gitGetStashRef()])
}

export async function gitApplyStash() {
  await git(['stash', 'apply', '--index', '-q', await gitGetStashRef()])
}

export async function getGitDir(cwd = '') {
  let dir = findUp(cwd, '.git')
  return dir
}

export async function gitAdd(paths) {
  let list = Array.isArray(paths) ? paths : [paths]

  if (list.length) {
    await git(['add', '-A', '--', ...list])
  }
}

export async function gitCheckout(paths) {
  let list = Array.isArray(paths) ? paths : [paths]

  if (list.length) {
    await git(['checkout', '-q', '--force', '--', ...list])
  }
}

export async function gitCreateStash() {
  try {
    let hash = await git(['stash', 'create'])
    await git(['stash', 'store', '-m', STASH_MESSAGE, '-q', hash.trim()])
  } catch (err) {
    throw 'Automatic backup is failed!'
  }
}

export async function gitGetStashRef() {
  let result = await git(['stash', 'list'])
  let index = result.split('\n').findIndex((line) => line.includes(STASH_MESSAGE))

  if (!~index) {
    throw 'Automatic backup is missing!'
  }

  return `refs/stash@{${index}}`
}

export async function gitGetStagedFiles({ gitDir, cwd }) {
  let entries = []

  try {
    let i = 0
    let lastIndex
    let raw = await git(['status', '-z'])

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
}
