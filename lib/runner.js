import { createGitWorkflow } from './git-workflow.js'
import { createTasksRunner } from './tasks-runner.js'
import { createReporter } from './reporter.js'
import { createRenderer } from './renderer.js'
import { NanoStagedError } from './errors.js'
import { createTask } from './task.js'
import { isTTY } from './utils.js'

export function createRunner({
  type = 'staged',
  allowEmpty,
  files = [],
  git_paths,
  config,
  stream,
  cwd,
}) {
  const reporter = createReporter(stream)

  const runner = {
    async run() {
      const changes = [...files.changed, ...files.deleted]

      const gitWorkflow = await createGitWorkflow({
        allowEmpty,
        rootPath: git_paths.root,
        dotPath: git_paths.dot,
      })

      const tasksRunner = await createTasksRunner({
        rootPath: git_paths.root,
        files: files.working,
        config,
        type,
        cwd,
      })

      if (!tasksRunner.tasks.some((task) => task.file_count > 0)) {
        reporter.error(new NanoStagedError('noMatchingFiles'))
        return
      }

      let enabled = false
      let revert = false
      let clear = true
      let errors = []
      let tasks = []
      let renderer

      tasks.push(
        createTask({
          title: `Preparing nano-staged`,
          run: async () => {
            try {
              await gitWorkflow.backupOriginalState()
            } catch (e) {
              enabled = true
              throw e
            }
          },
        })
      )

      tasks.push(
        createTask({
          title: `Backing up unstaged changes for staged files`,
          run: async () => {
            try {
              await gitWorkflow.backupUnstagedFiles(changes)
            } catch (e) {
              revert = true
              throw e
            }
          },
          skipped: () => enabled || type === 'unstaged' || type === 'diff' || changes.length === 0,
        })
      )

      tasks.push(
        createTask({
          title: `Running tasks for ${type} files`,
          run: async (task) => {
            task.tasks = tasksRunner.tasks

            try {
              await tasksRunner.run(task)
            } catch (e) {
              revert = true
              throw e
            }
          },
          skipped: () => enabled || revert,
        })
      )

      tasks.push(
        createTask({
          title: `Applying modifications from tasks`,
          run: async () => {
            try {
              await gitWorkflow.applyModifications(files.working)
            } catch (e) {
              revert = true
              throw e
            }
          },
          skipped: () => enabled || revert || type === 'unstaged' || type === 'diff',
        })
      )

      tasks.push(
        createTask({
          title: `Restoring unstaged changes for staged files`,
          run: async () => {
            try {
              await gitWorkflow.restoreUnstagedFiles(changes)
            } catch (e) {
              throw e
            }
          },
          skipped: () =>
            enabled || revert || type === 'unstaged' || type === 'diff' || changes.length === 0,
        })
      )

      tasks.push(
        createTask({
          title: `Restoring to original state because of errors`,
          run: async () => {
            try {
              await gitWorkflow.restoreOriginalState()
            } catch (e) {
              clear = false
              throw e
            }
          },
          skipped: () => enabled || !revert,
        })
      )

      tasks.push(
        createTask({
          title: `Cleaning up temporary to patch files`,
          run: async () => {
            try {
              await gitWorkflow.cleanUp()
            } catch (e) {
              throw e
            }
          },
          skipped: () => enabled || !clear,
        })
      )

      for (const task of tasks) {
        if (!task.skipped()) {
          if (isTTY) {
            if (!renderer) {
              renderer = createRenderer(task, stream).start()
            } else {
              renderer.register(task)
            }
          }

          try {
            task.state = 'run'
            await task.run(task)
            task.state = 'done'
          } catch (e) {
            task.state = 'fail'
            errors.push(e)
          }
        }
      }

      renderer && renderer.stop && renderer.stop()

      if (errors.length) {
        throw errors
      }
    },
  }

  return runner
}
