import fs from 'fs'
import { resolve } from 'path'

import { createDebug } from './debug.js'
import { createGit } from './git.js'

export function createGitWorkflow({ allowEmpty = false, dotPath = '', rootPath = '' } = {}) {
  const debug = createDebug('nano-staged:git-workflow')
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
          debug('Reading patch `%s`', path)

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
        debug('Backing up original state...')
        await git.diff(patch.original)
        debug('Done backing up original state!')
      } catch (e) {
        throw e
      }
    },

    async backupUnstagedFiles(files = []) {
      if (files.length) {
        try {
          debug('Backing up usntaged files...')
          await git.diff(patch.unstaged, files)
          await git.checkout(files)
          debug('Done backing up usntaged files!')
        } catch (e) {
          throw e
        }
      }
    },

    async applyModifications(files = []) {
      if (files.length) {
        try {
          debug('Adding task modifications to index...')

          if (!(await git.exec(['diff', 'HEAD'])) && !allowEmpty) {
            throw 'Prevented an empty git commit!'
          }

          await git.add(files)
          debug('Done adding task modifications to index!')
        } catch (e) {
          throw e
        }
      }
    },

    async restoreUnstagedFiles(files = []) {
      if (files.length) {
        try {
          debug('Restoring unstaged changes...')
          await git.apply(patch.unstaged)
        } catch (applyError) {
          debug('Error while restoring changes:')
          debug(applyError)
          debug('Retrying with 3-way merge')

          try {
            await git.apply(patch.unstaged, true)
          } catch (threeWayApplyError) {
            debug('Error while restoring unstaged changes using 3-way merge:')
            debug(threeWayApplyError)
            throw 'Merge conflict!!! Unstaged changes not restored.'
          }
        }
      }
    },

    async restoreOriginalState() {
      try {
        debug('Restoring original state...')
        await git.checkout('.')

        if (workflow.hasPatch(patch.original)) {
          await git.apply(patch.original)
        }

        debug('Done restoring original state!')
      } catch (e) {
        throw e
      }
    },

    async cleanUp() {
      try {
        debug('Removing temp files...')

        if (workflow.hasPatch(patch.original)) {
          fs.unlinkSync(patch.original)
        }

        if (workflow.hasPatch(patch.unstaged)) {
          fs.unlinkSync(patch.unstaged)
        }

        debug('Done removing temp files!')
      } catch (e) {
        throw e
      }
    },
  }

  return workflow
}
