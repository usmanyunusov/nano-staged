import { normalize, relative, resolve, isAbsolute } from 'path'

import { CHANGED_CODE, DELETED_CODE } from './git.js'
import { globToRegex } from './glob-to-regex.js'

export function prepareFiles({
  repoPath = '',
  cwd = process.cwd(),
  entries = [],
  config = {},
} = {}) {
  let deletedFiles = []
  let changedFiles = []
  let workingFiles = []
  let taskedFiles = []

  for (let pattern of Object.keys(config)) {
    let matches = globToRegex(pattern, { extended: true, globstar: pattern.includes('/') })

    for (let { path, type, rename } of entries) {
      path = normalize(relative(cwd, normalize(resolve(repoPath, rename || path))))
      path = path.replace(/\\/g, '/')

      if (!pattern.startsWith('../') && (path.startsWith('..') || isAbsolute(path))) {
        continue
      }

      if (matches.regex.test(path)) {
        path = resolve(cwd, path)

        if (!workingFiles.includes(path)) {
          if (type === CHANGED_CODE) {
            changedFiles.push(path)
          }

          if (type === DELETED_CODE) {
            deletedFiles.push(path)
          }

          workingFiles.push(path)
        }

        taskedFiles.push([pattern, path])
      }
    }
  }

  return { workingFiles, deletedFiles, changedFiles, taskedFiles }
}
