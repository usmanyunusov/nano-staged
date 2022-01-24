import { resolve } from 'path'

import * as fs from './file.js'
import { createGit } from './git.js'

const PARTIAL_PATCH = 'nano-staged_partial.patch'
const ORIGIN_PATCH = 'nano-staged.patch'

export async function createGitWorkflow({
  allowEmpty = false,
  dotGitPath = '',
  repoPath = '',
} = {}) {
  let git = createGit(repoPath)

  let patch = {
    unstaged: resolve(dotGitPath, `./${PARTIAL_PATCH}`),
    original: resolve(dotGitPath, `./${ORIGIN_PATCH}`),
  }

  return {
    async hasPatch(path = '') {
      let has = false

      if (path) {
        let buffer = await fs.read(path)
        has = buffer && buffer.toString()
      }

      return Boolean(has)
    },

    async backupOriginalState() {
      try {
        await git.diff(patch.original)
      } catch (err) {
        throw err
      }
    },

    async backupUnstagedFiles(files = []) {
      if (files.length) {
        try {
          await git.diff(patch.unstaged, files)
          await git.checkout(files)
        } catch (err) {
          throw err
        }
      }
    },

    async applyModifications(files = []) {
      if (files.length) {
        try {
          if (!(await git.exec(['diff', 'HEAD'])) && !allowEmpty) {
            throw 'Nano Staged prevented an empty git commit.'
          }

          await git.add(files)
        } catch (err) {
          throw err
        }
      }
    },

    async restoreUnstagedFiles(files = []) {
      if (files.length) {
        try {
          await git.apply(patch.unstaged)
        } catch (err) {
          try {
            await git.apply(patch.unstaged, true)
          } catch (err) {
            throw 'Merge conflict!!! Unstaged changes not restored.'
          }
        }
      }
    },

    async restoreOriginalState() {
      try {
        await git.checkout('.')

        if (await this.hasPatch(patch.original)) {
          await git.apply(patch.original)
        }
      } catch (err) {
        throw err
      }
    },

    async cleanUp() {
      try {
        if (await this.hasPatch(patch.original)) {
          await fs.unlink(patch.original)
        }

        if (await this.hasPatch(patch.unstaged)) {
          await fs.unlink(patch.unstaged)
        }
      } catch (err) {
        throw err
      }
    },
  }
}
