import { createGitWorkflow } from './git-workflow.js'
import { createCmdRunner } from './cmd-runner.js'
import { createReporter } from './reporter.js'
import { createRenderer } from './renderer.js'
import { NanoStagedError } from './errors.js'
import { createDebug } from './debug.js'
import { Task } from './task.js'

export function createRunner({ allowEmpty, git_paths, config, stream, files, type, cwd }) {
  const reporter = createReporter(stream)
  const renderer = createRenderer(stream, { isTTY: !createDebug.enabled && !process.env.CI })

  const runner = {
    async run() {
      const changes = [...files.changed, ...files.deleted]

      const gitWorkflow = createGitWorkflow({
        allowEmpty,
        rootPath: git_paths.root,
        dotPath: git_paths.dot,
      })

      const cmdRunner = createCmdRunner({
        rootPath: git_paths.root,
        files: files.working,
        config,
        type,
        cwd,
      })

      const cmdTasks = await cmdRunner.generateCmdTasks()

      if (!cmdTasks.some((task) => task.file_count > 0)) {
        reporter.error(new NanoStagedError('noMatchingFiles'))
        return
      }

      let enabled = false
      let revert = false
      let clear = true
      let errors = []
      let tasks = []

      tasks.push(
        new Task({
          title: `Preparing nano-staged`,
          async run() {
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
        new Task({
          title: `Backing up unstaged changes for staged files`,
          async run() {
            try {
              await gitWorkflow.backupUnstagedFiles(changes)
            } catch (e) {
              revert = true
              throw e
            }
          },
          isSkip: () => enabled || type === 'unstaged' || type === 'diff' || changes.length === 0,
        })
      )

      tasks.push(
        new Task({
          title: `Running tasks for ${type} files`,
          async run(task) {
            task.tasks = cmdTasks

            try {
              await cmdRunner.run(task)
            } catch (e) {
              revert = true
              throw e
            }
          },
          isSkip: () => enabled || revert,
        })
      )

      tasks.push(
        new Task({
          title: `Applying modifications from tasks`,
          async run() {
            try {
              await gitWorkflow.applyModifications(files.working)
            } catch (e) {
              revert = true
              throw e
            }
          },
          isSkip: () => enabled || revert || type === 'unstaged' || type === 'diff',
        })
      )

      tasks.push(
        new Task({
          title: `Restoring unstaged changes for staged files`,
          async run() {
            try {
              await gitWorkflow.restoreUnstagedFiles(changes)
            } catch (e) {
              throw e
            }
          },
          isSkip: () =>
            enabled || revert || type === 'unstaged' || type === 'diff' || changes.length === 0,
        })
      )

      tasks.push(
        new Task({
          title: `Restoring to original state because of errors`,
          async run() {
            try {
              await gitWorkflow.restoreOriginalState()
            } catch (e) {
              clear = false
              throw e
            }
          },
          isSkip: () => enabled || !revert,
        })
      )

      tasks.push(
        new Task({
          title: `Cleaning up temporary to patch files`,
          async run() {
            try {
              await gitWorkflow.cleanUp()
            } catch (e) {
              throw e
            }
          },
          isSkip: () => enabled || !clear,
        })
      )

      for (const task of tasks) {
        if (!task.isSkip()) {
          renderer.start(task)

          try {
            task.state$ = 'run'
            await task.run(task)
            task.state$ = 'done'
          } catch (e) {
            task.state$ = 'fail'
            errors.push(e)
          }

          renderer.render()
        }
      }

      renderer.stop()

      if (errors.length) {
        throw errors
      }
    },
  }

  return runner
}
