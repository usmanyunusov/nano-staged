import { toAbsolute, toRelative, toArray } from '../utils/index.js'
import { CHANGED_CODE, DELETED_CODE } from '../git/index.js'
import { glob } from '../glob/index.js'

export function prepareFiles({
  gitRootPath = process.cwd(),
  cwd = process.cwd(),
  entries = [],
  config = {},
} = {}) {
  let deleted = []
  let changed = []
  let staged = []
  let tasks = []

  for (let [pattern, cmd] of Object.entries(config)) {
    let matches = glob(pattern, { filepath: true, extended: true })
    let cmds = toArray(cmd)
    let subTasks = []
    let files = []

    for (let { path, type, rename } of entries) {
      path = toRelative(toAbsolute(rename || path, gitRootPath), cwd)

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

        files.push(path)
      }
    }

    for (let cmd of cmds) {
      subTasks.push({
        pattern,
        cmd,
        files,
      })
    }

    tasks.push(subTasks)
  }

  return { tasks, staged, deleted, changed }
}
