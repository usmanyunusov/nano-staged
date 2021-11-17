import { toArray } from '../utils/index.js'
import { normalize, relative, resolve, isAbsolute } from 'path'
import { CHANGED_CODE, DELETED_CODE } from '../git/index.js'
import { glob } from '../glob/index.js'

export function prepareFiles({
  repoPath = '',
  cwd = process.cwd(),
  entries = [],
  config = {},
} = {}) {
  let deletedFiles = []
  let changedFiles = []
  let stagedFiles = []
  let allTasks = []

  for (let [pattern, cmd] of Object.entries(config)) {
    let matches = glob(pattern, { filepath: true, extended: true })
    let cmds = toArray(cmd)
    let subTasks = []
    let files = []

    for (let { path, type, rename } of entries) {
      path = normalize(relative(cwd, normalize(resolve(repoPath, rename || path))))

      if (!pattern.startsWith('../') && (path.startsWith('..') || isAbsolute(path))) {
        continue
      }

      if (matches.regex.test(path)) {
        path = resolve(cwd, path)

        if (stagedFiles.indexOf(path) === -1) {
          if (type === CHANGED_CODE) {
            changedFiles.push(path)
          }

          if (type === DELETED_CODE) {
            deletedFiles.push(path)
          }

          stagedFiles.push(path)
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

    allTasks.push(subTasks)
  }

  return { allTasks, stagedFiles, deletedFiles, changedFiles }
}
