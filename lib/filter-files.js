import { CHANGED_CODE, DELETED_CODE } from './git.js'

export async function filterFiles(entries = []) {
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
}
