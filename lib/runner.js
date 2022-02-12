import { createReporter } from './create-reporter.js'
import { createGitWorkflow } from './git-workflow.js'
import { createTaskRunner } from './task-runner.js'
import { NanoStagedError } from './error.js'
import { Spinner } from './spinner.js'
import { createGit } from './git.js'

export function createRunner({ cwd, stream, allowEmpty, config }) {
  const git = createGit(cwd)
  const report = createReporter(stream)

  const runner = {
    async run(type = 'staged', { refs = [] } = {}) {
      const { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

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
        report.error(new NanoStagedError('noFiles', type))
        return
      }

      const changes = [...files.changed, ...files.deleted]
      const gitWorkflow = await createGitWorkflow({ allowEmpty, repoPath, dotGitPath })
      const taskRunner = await createTaskRunner({
        files: files.working,
        repoPath,
        config,
        type,
        cwd,
      })

      if (!taskRunner.tasks.some(({ files }) => files.length > 0)) {
        report.error(new NanoStagedError('noMatchingFiles'))
        return
      }

      let spinner = new Spinner({ stream })
      let enabled = false
      let revert = false
      let clear = true
      let errors = []
      let steps = []

      steps.push({
        title: `Preparing nano-staged...`,
        task: async () => {
          try {
            await gitWorkflow.backupOriginalState()
          } catch (e) {
            enabled = true
            throw e
          }
        },
      })

      steps.push({
        title: `Backing up unstaged changes for staged files...`,
        task: async () => {
          try {
            await gitWorkflow.backupUnstagedFiles(changes)
          } catch (e) {
            revert = true
            throw e
          }
        },
        isSkipped: () => enabled || type === 'unstaged' || type === 'diff' || changes.length === 0,
      })

      steps.push({
        title: `Running tasks for ${type} files...`,
        task: async (spin) => {
          try {
            await taskRunner.run(spin)
          } catch (e) {
            revert = true
            throw e
          }
        },
        isSkipped: () => enabled || revert,
      })

      steps.push({
        title: `Applying modifications from tasks...`,
        task: async () => {
          try {
            await gitWorkflow.applyModifications(files.working)
          } catch (e) {
            revert = true
            throw e
          }
        },
        isSkipped: () => enabled || revert || type === 'unstaged' || type === 'diff',
      })

      steps.push({
        title: `Restoring unstaged changes for staged files...`,
        task: async () => {
          try {
            await gitWorkflow.restoreUnstagedFiles(changes)
          } catch (e) {
            throw e
          }
        },
        isSkipped: () =>
          enabled || revert || type === 'unstaged' || type === 'diff' || changes.length === 0,
      })

      steps.push({
        title: `Restoring to original state because of errors....`,
        task: async () => {
          try {
            await gitWorkflow.restoreOriginalState()
          } catch (e) {
            clear = false
            throw e
          }
        },
        isSkipped: () => enabled || !revert,
      })

      steps.push({
        title: `Cleaning up temporary to patch files...`,
        task: async () => {
          try {
            await gitWorkflow.cleanUp()
          } catch (e) {
            throw e
          }
        },
        isSkipped: () => enabled || !clear,
      })

      for (let { title, task, isSkipped = () => false } of steps) {
        if (!isSkipped()) {
          let spin = spinner.create(title)

          try {
            spin.start()
            await task(spin)
            spin.success()
          } catch (e) {
            spin.error()
            errors.push(e)
          }
        }
      }

      spinner.stop()

      if (errors.length) {
        throw errors
      }
    },
  }

  return runner
}
