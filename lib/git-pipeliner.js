import { resolve } from 'path'
import c from 'picocolors'

import { createReporter } from './create-reporter.js'
import { createTaskRunner } from './task-runner.js'
import { filterFiles } from './filter-files.js'
import { fileSystem } from './file-system.js'
import { createGit } from './git.js'

const ORIGIN_PATCH = 'nano-staged.patch'
const PARTIAL_PATCH = 'nano-staged_partial.patch'

function done(msg = '') {
  return c.dim(`  ${c.gray('»')} ${msg}`)
}

function fail(msg = '') {
  return c.dim(`  ${c.gray('»')} ${msg}`)
}

export async function createGitPipeliner({ stream, cwd, allowEmpty, config }) {
  let git = createGit(cwd)
  let fs = fileSystem()

  let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()
  if (!repoPath) {
    info('Nano Staged didn’t find git directory')
    return
  }

  let patch = {
    original: resolve(dotGitPath, `./${ORIGIN_PATCH}`),
    unstaged: resolve(dotGitPath, `./${PARTIAL_PATCH}`),
  }

  let { log, step, info } = createReporter({ stream })

  return {
    async staged() {
      let steps = []

      let entries = await git.stagedFiles({ cwd: repoPath })
      if (!entries.length) {
        info(`Git staging area is empty.`)
        return
      }

      let files = await filterFiles(entries)
      let runner = await createTaskRunner(files.working, config, repoPath, cwd, stream)

      if (!runner.tasks.every(({ files }) => files.length > 0)) {
        info(`No files match any configured task.`)
        return
      }

      steps.push(async () => {
        step('Preparing staged pipeliner')
        await this.backupOriginalState()
      })

      steps.push(async () => {
        await this.backupUnstagedFiles([...files.changed, ...files.deleted])
      })

      steps.push(async () => {
        step('Running tasks')

        try {
          await runner.runTasks()
        } catch (err) {
          await this.restoreOriginalState()
          throw err
        }
      })

      steps.push(async () => {
        await this.applyModifications(files.working)
      })

      steps.push(async () => {
        await this.restoreUnstagedFiles([...files.changed, ...files.deleted])
      })

      steps.push(async () => {
        await this.cleanUp()
      })

      for (const step of steps) {
        await step()
      }
    },

    async unstaged() {
      let steps = []

      let entries = await git.unstagedFiles({ cwd: repoPath })
      if (!entries.length) {
        info(`Git unstaging area is empty.`)
        return
      }

      let files = await filterFiles(entries)
      let runner = await createTaskRunner(files.working, config, repoPath, cwd, stream)

      if (!runner.tasks.every(({ files }) => files.length > 0)) {
        info(`No files match any configured task.`)
        return
      }

      steps.push(async () => {
        step('Preparing unstaged pipeliner')
        await this.backupOriginalState()
      })

      steps.push(async () => {
        step('Running tasks')

        try {
          await runner.runTasks()
        } catch (err) {
          await this.restoreOriginalState()
          throw err
        }
      })

      steps.push(async () => {
        await this.cleanUp()
      })

      for (const step of steps) {
        await step()
      }
    },

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
        log(done(`Done backing up original repo state.`))
      } catch (err) {
        log(fail(`Fail backing up original repo state.`))
        throw err
      }
    },

    async backupUnstagedFiles(files = []) {
      if (files.length) {
        step('Backing up unstaged changes for staged files.')

        try {
          await git.diff(patch.unstaged, files)
          await git.checkout(files)
          log(done(`Done backing up unstaged changes.`))
        } catch (err) {
          log(fail(`Fail backing up unstaged changes.`))
          await this.restoreOriginalState()
          throw err
        }
      }
    },

    async applyModifications(files = []) {
      step('Applying modifications')

      try {
        if (!(await git.exec(['diff', 'HEAD'])) && !allowEmpty) {
          let err = new Error()
          err.emptyCommit = true
          err.tasks = c.yellow(
            'Nano Staged prevented an empty git commit.\nUse the --allow-empty option to continue, or check your task configuration'
          )
          throw err
        }

        await git.add(files)
        log(done(`Done adding up all task modifications to index.`))
      } catch (err) {
        log(fail(`Fail adding up all task modifications to index.`))

        if (!!err.emptyCommit) {
          log(fail(`Prevented an empty git commit.`))
        }

        await this.restoreOriginalState()
        throw err
      }
    },

    async restoreUnstagedFiles(files = []) {
      if (files.length) {
        step('Restoring unstaged changes for staged files.')

        try {
          await git.apply(patch.unstaged)
          log(done(`Done restoring up unstaged changes.`))
        } catch (err) {
          try {
            await git.apply(patch.unstaged, true)
          } catch (err) {
            log(fail(`Merge conflict!!! Unstaged changes not restored.`))
            await this.restoreOriginalState()
            throw err
          }
        }
      }
    },

    async restoreOriginalState() {
      step('Restoring to its original state')

      try {
        await git.checkout('.')

        let hasPatch = await this.hasPatch(patch.original)
        if (hasPatch) {
          await git.apply(patch.original)
        }

        log(done(`Done restoring up to its original state.`))
      } catch (err) {
        log(fail(`Fail restoring up to its original state.`))
        throw err
      }

      await this.cleanUp()
    },

    async cleanUp() {
      step('Removing patch files')

      try {
        let hasOriginalPatch = await this.hasPatch(patch.original)
        if (hasOriginalPatch) {
          await fs.delete(patch.original)
        }

        let hasUnstagedPatch = await this.hasPatch(patch.unstaged)
        if (hasUnstagedPatch) {
          await fs.delete(patch.unstaged)
        }

        log(done(`Done removing up patch files.`))
      } catch (err) {
        log(fail(`Fail removing up patch files.`))
        throw err
      }
    },
  }
}
