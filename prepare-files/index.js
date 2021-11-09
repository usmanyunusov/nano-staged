import { CHANGED_CODE, DELETED_CODE } from '../git/index.js'
import glob from 'globrex'

export function prepareFiles(entries, config) {
  let staged = []
  let deleted = []
  let changed = []
  let tasks = []

  for (let [pattern, cmd] of Object.entries(config)) {
    let subTasks = []
    let cmds = Array.isArray(cmd) ? cmd : [cmd]

    let matches = glob(pattern, { extended: true })
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
