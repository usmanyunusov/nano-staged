import { promises as fs } from 'fs'
import { resolve } from 'path'

import { createGit } from './git.js'

const PARTIAL_PATCH = 'nano-staged_partial.patch'
const ORIGIN_PATCH = 'nano-staged.patch'

export async function createGitWorkflow({
  allowEmpty = false,
  dotGitPath = '',
  repoPath = '',
} = {}) {
  const git = createGit(repoPath)
  const patch = {
    unstaged: resolve(dotGitPath, `./${PARTIAL_PATCH}`),
    original: resolve(dotGitPath, `./${ORIGIN_PATCH}`),
  }

  return {
    async hasPatch(path = '') {
      let has = false

      if (path) {
        try {
          let buffer = await fs.readFile(path)
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

        if (await this.hasPatch(patch.original)) {
          await git.apply(patch.original)
        }
      } catch (e) {
        throw e
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
      } catch (e) {
        throw e
      }
    },
  }
}
