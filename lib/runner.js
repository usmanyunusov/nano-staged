import { createReporter } from './create-reporter.js'
import { createGitWorkflow } from './git-workflow.js'
import { createTaskRunner } from './task-runner.js'
import { createGit } from './git.js'

export async function createRunner({
  stream = process.stderr,
  cwd = process.cwd(),
  allowEmpty = false,
  config = {},
} = {}) {
  let { info, step } = createReporter({ stream })
  let git = createGit(cwd)

  return {
    async steps(...tasks) {
      let ctx = { errors: [], stop: false }

      for (let { task, title = '', enabled = () => false } of tasks) {
        if (!ctx.stop) {
          if (!enabled(ctx) && task) {
            try {
              step(title)
              await task(ctx)
            } catch (err) {
              ctx.errors.push(err)
            }
          }
        }
      }

      if (ctx.errors.length) {
        throw ctx.errors
      }
    },

    async run(type = 'staged', { refs = [] } = {}) {
      let { repoPath, dotGitPath } = await git.getRepoAndDotGitPaths()

      if (!repoPath) {
        info('Nano Staged didn’t find git directory')
        return
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
        info(`No ${type} files found.`)
        return
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
        info(`No files match any configured task.`)
        return
      }

      await this.steps(
        {
          title: `Preparing nano-staged`,
          task: (сtx) =>
            gitWorkflow.backupOriginalState().catch((err) => {
              сtx.stop = true
              throw err
            }),
        },
        {
          title: 'Backing up unstaged changes for staged files',
          task: (сtx) =>
            gitWorkflow.backupUnstagedFiles(changes).catch((err) => {
              сtx.revert = true
              throw err
            }),
          enabled: (сtx) => type === 'unstaged' || type === 'diff' || !changes.length || сtx.revert,
        },
        {
          title: `Running tasks for ${type} files`,
          task: (сtx) =>
            taskRunner.run().catch((err) => {
              сtx.revert = true
              throw err
            }),
          enabled: (сtx) => сtx.revert,
        },
        {
          title: 'Applying modifications from tasks',
          task: (сtx) =>
            gitWorkflow.applyModifications(files.working).catch((err) => {
              сtx.revert = true
              throw err
            }),
          enabled: (сtx) => type === 'unstaged' || type === 'diff' || сtx.revert,
        },
        {
          title: 'Restoring unstaged changes for staged files',
          task: (сtx) =>
            gitWorkflow.restoreUnstagedFiles(changes).catch((err) => {
              сtx.revert = true
              throw err
            }),
          enabled: (сtx) => type === 'unstaged' || type === 'diff' || !changes.length || сtx.revert,
        },
        {
          title: 'Restoring to its original state',
          task: (ctx) =>
            gitWorkflow.restoreOriginalState().catch((err) => {
              ctx.noClean = true
              throw err
            }),
          enabled: (ctx) => !ctx.revert,
        },
        {
          title: 'Removing temporary to patch files',
          task: () => gitWorkflow.cleanUp(),
          enabled: (ctx) => ctx.noClean,
        }
      )
    },
  }
}
