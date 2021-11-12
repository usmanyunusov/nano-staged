import { CHANGED_CODE, DELETED_CODE } from '../git/index.js'
import { globrex } from '../globrex/index.js'
import { toArray } from '../utils/index.js'

export function prepareFiles(entries, config) {
  let deleted = []
  let changed = []
  let staged = []
  let tasks = []

  for (let [pattern, cmd] of Object.entries(config)) {
    let matches = globrex(pattern, { extended: true })
    let cmds = toArray(cmd)
    let subTasks = []

    let files = entries.filter(({ path, type }) => {
      if (matches.regex.test(path)) {
        if (staged.indexOf(path) === -1) {
          if (type === CHANGED_CODE) {
            changed.push(path)
          }

          if (type === DELETED_CODE) {
            deleted.push(path)
          }

          staged.push(path)
        }

        return true
      }
    })

    for (let cmd of cmds) {
      subTasks.push({
        pattern,
        cmd,
        files: files.map(({ path }) => path),
      })
    }

    tasks.push(subTasks)
  }

  return { tasks, staged, deleted, changed }
}
