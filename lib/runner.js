import { createReporter } from './create-reporter.js'
import { createGitWorkflow } from './git-workflow.js'
import { createTaskRunner } from './task-runner.js'
import { NanoStagedError } from './error.js'
import { createGit } from './git.js'

export async function createRunner({
  stream = process.stderr,
  cwd = process.cwd(),
  allowEmpty = false,
  config = {},
} = {}) {
  let git = createGit(cwd)
  let reporter = createReporter({ stream })

  return {
    async run(type = 'staged', { refs = [] } = {}) {
      let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

      if (!repoPath) {
        throw new NanoStagedError('noGitRepo')
      }

      let files
      if (type === 'unstaged') {
        files = await git.unstagedFiles({ cwd: repoPath })
      } else if (type === 'diff') {
        files = await git.changedFiles(refs, { cwd: repoPath })
      } else {
        files = await git.stagedFiles({ cwd: repoPath })
      }

      if (!files.working.length) {
        throw new NanoStagedError('noFiles', type)
      }

      let changes = [...files.changed, ...files.deleted]
      let gitWorkflow = await createGitWorkflow({ allowEmpty, repoPath, dotGitPath })
      let taskRunner = await createTaskRunner({
        files: files.working,
        repoPath,
        config,
        stream,
        type,
        cwd,
      })

      if (!taskRunner.tasks.some(({ files }) => files.length > 0)) {
        throw new NanoStagedError('noMatchingFiles')
      }

      let clear = true
      let revert = false
      let skip = false
      let steps = []
      let taskError

      steps.push(async (title = 'Preparing nano-staged') => {
        try {
          await gitWorkflow.backupOriginalState()
          reporter.step(title)
        } catch (err) {
          reporter.step(title, err)
          skip = true
        }
      })

      steps.push(async (title = 'Backing up unstaged changes for staged files') => {
        if (!skip && !revert && type !== 'unstaged' && type !== 'diff' && changes.length) {
          try {
            await gitWorkflow.backupUnstagedFiles(changes)
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
            revert = true
          }
        }
      })

      steps.push(async (title = `Running tasks for ${type} files`) => {
        if (!skip && !revert) {
          try {
            reporter.step(title)
            await taskRunner.run()
          } catch (err) {
            taskError = err
            revert = true
          }
        }
      })

      steps.push(async (title = 'Applying modifications from tasks') => {
        if (!skip && !revert && type !== 'unstaged' && type !== 'diff') {
          try {
            await gitWorkflow.applyModifications(files.working)
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
            revert = true
          }
        }
      })

      steps.push(async (title = 'Restoring unstaged changes for staged files') => {
        if (!skip && !revert && type !== 'unstaged' && type !== 'diff' && changes.length) {
          try {
            await gitWorkflow.restoreUnstagedFiles(changes)
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
          }
        }
      })

      steps.push(async (title = 'Restoring to its original state') => {
        if (!skip && revert) {
          try {
            await gitWorkflow.restoreOriginalState()
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
            clear = false
          }
        }
      })

      steps.push(async (title = 'Removing temporary to patch files') => {
        if (!skip && clear) {
          try {
            await gitWorkflow.cleanUp()
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
          }
        }
      })

      for (let step of steps) {
        await step()
      }

      if (taskError) {
        throw taskError
      }
    },
  }
}
