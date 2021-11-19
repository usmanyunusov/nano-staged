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
  let taskedFiles = []

  for (let pattern of Object.keys(config)) {
    let matches = glob(pattern, { globstar: true, filepath: true, extended: true })

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

        taskedFiles.push([pattern, path])
      }
    }
  }

  return { stagedFiles, deletedFiles, changedFiles, taskedFiles }
}
