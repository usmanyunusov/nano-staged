import fs from 'fs'
import { resolve } from 'path'

import { createGit } from './git.js'

export function createGitWorkflow({ allowEmpty = false, dotPath = '', rootPath = '' } = {}) {
  const git = createGit(rootPath)
  const patch = {
    unstaged: resolve(dotPath, './nano-staged_partial.patch'),
    original: resolve(dotPath, './nano-staged.patch'),
  }

  const workflow = {
    hasPatch(path = '') {
      let has = false

      if (path) {
        try {
          let buffer = fs.readFileSync(path)
          has = buffer && buffer.toString()
        } catch {
          has = false
        }
      }

      return Boolean(has)
    },

    async backupOriginalState() {
      try {
        await git.diff(patch.original)
      } catch (e) {
        throw e
      }
    },

    async backupUnstagedFiles(files = []) {
      if (files.length) {
        try {
          await git.diff(patch.unstaged, files)
          await git.checkout(files)
        } catch (e) {
          throw e
        }
      }
    },

    async applyModifications(files = []) {
      if (files.length) {
        try {
          if (!(await git.exec(['diff', 'HEAD'])) && !allowEmpty) {
            throw 'Prevented an empty git commit!'
          }

          await git.add(files)
        } catch (e) {
          throw e
        }
      }
    },

    async restoreUnstagedFiles(files = []) {
      if (files.length) {
        try {
          await git.apply(patch.unstaged)
        } catch {
          try {
            await git.apply(patch.unstaged, true)
          } catch {
            throw 'Merge conflict!!! Unstaged changes not restored.'
          }
        }
      }
    },

    async restoreOriginalState() {
      try {
        await git.checkout('.')

        if (workflow.hasPatch(patch.original)) {
          await git.apply(patch.original)
        }
      } catch (e) {
        throw e
      }
    },

    async cleanUp() {
      try {
        if (workflow.hasPatch(patch.original)) {
          fs.unlinkSync(patch.original)
        }

        if (workflow.hasPatch(patch.unstaged)) {
          fs.unlinkSync(patch.unstaged)
        }
      } catch (e) {
        throw e
      }
    },
  }

  return workflow
}
