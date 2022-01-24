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

      let pipeline = {
        ctx: {
          taskError: null,
          stop: false,
          revert: false,
          noClean: false,
        },
        steps: [],
      }

      pipeline.steps.push(async (ctx, title = 'Preparing nano-staged') => {
        try {
          await gitWorkflow.backupOriginalState()
          reporter.step(title)
        } catch (err) {
          reporter.step(title, err)
          ctx.stop = true
        }
      })

      pipeline.steps.push(async (ctx, title = 'Backing up unstaged changes for staged files') => {
        if (!ctx.stop && !ctx.revert && type !== 'unstaged' && type !== 'diff' && changes.length) {
          try {
            await gitWorkflow.backupUnstagedFiles(changes)
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
            ctx.revert = true
          }
        }
      })

      pipeline.steps.push(async (ctx, title = `Running tasks for ${type} files`) => {
        if (!ctx.stop && !ctx.revert) {
          try {
            reporter.step(title)
            await taskRunner.run()
          } catch (err) {
            ctx.taskError = err
            ctx.revert = true
          }
        }
      })

      pipeline.steps.push(async (ctx, title = 'Applying modifications from tasks') => {
        if (!ctx.stop && !ctx.revert && type !== 'unstaged' && type !== 'diff') {
          try {
            await gitWorkflow.applyModifications(files.working)
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
            ctx.revert = true
          }
        }
      })

      pipeline.steps.push(async (ctx, title = 'Restoring unstaged changes for staged files') => {
        if (!ctx.stop && !ctx.revert && type !== 'unstaged' && type !== 'diff' && changes.length) {
          try {
            await gitWorkflow.restoreUnstagedFiles(changes)
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
          }
        }
      })

      pipeline.steps.push(async (ctx, title = 'Restoring to its original state') => {
        if (!ctx.stop && ctx.revert) {
          try {
            await gitWorkflow.restoreOriginalState()
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
            ctx.noClean = true
          }
        }
      })

      pipeline.steps.push(async (ctx, title = 'Removing temporary to patch files') => {
        if (!ctx.stop && !ctx.noClean) {
          try {
            await gitWorkflow.cleanUp()
            reporter.step(title)
          } catch (err) {
            reporter.step(title, err)
          }
        }
      })

      for (let step of pipeline.steps) {
        await step(pipeline.ctx)
      }

      if (pipeline.ctx.taskError) {
        throw pipeline.ctx.taskError
      }
    },
  }
}
