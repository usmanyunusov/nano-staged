import { is, equal } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('should return when no files match any configured task', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 0 }],
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch (error) {
    is(error.message, 'No files match any configured task.')
  }
})

test('should step success', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.resolve(),
        applyModifications: async () => Promise.resolve(),
        restoreUnstagedFiles: async () => Promise.resolve(),
        restoreOriginalState: async () => Promise.resolve(),
        cleanUp: async () => Promise.resolve(),
      }),
    },
  })

  await createRunner({ stream: stdout, git_paths, files }).run()

  is(
    stdout.out,
    '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
      '\x1B[32m√\x1B[39m Backing up unstaged changes for staged files\n' +
      '\x1B[32m√\x1B[39m Applying modifications from tasks\n' +
      '\x1B[32m√\x1B[39m Restoring unstaged changes for staged files\n' +
      '\x1B[32m√\x1B[39m Cleaning up temporary to patch files\n'
  )
})

test('should backupOriginalState error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.reject('backupOriginalState fail'),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch {
    is(stdout.out, '\x1B[31m×\x1B[39m Preparing nano-staged\n')
  }
})

test('should backupUnstagedFiles error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.reject('backupUnstagedFiles fail'),
        restoreOriginalState: async () => Promise.resolve(),
        cleanUp: async () => Promise.resolve(),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch {
    is(
      stdout.out,
      '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
        '\x1B[31m×\x1B[39m Backing up unstaged changes for staged files\n' +
        '\x1B[32m√\x1B[39m Restoring to original state because of errors\n' +
        '\x1B[32m√\x1B[39m Cleaning up temporary to patch files\n'
    )
  }
})

test('should applyModifications error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.resolve(),
        applyModifications: async () => Promise.reject('applyModifications fail'),
        restoreOriginalState: async () => Promise.resolve(),
        cleanUp: async () => Promise.resolve(),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch {
    is(
      stdout.out,
      '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
        '\x1B[32m√\x1B[39m Backing up unstaged changes for staged files\n' +
        '\x1B[31m×\x1B[39m Applying modifications from tasks\n' +
        '\x1B[32m√\x1B[39m Restoring to original state because of errors\n' +
        '\x1B[32m√\x1B[39m Cleaning up temporary to patch files\n'
    )
  }
})

test('should restoreUnstagedFiles error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.resolve(),
        applyModifications: async () => Promise.resolve(),
        restoreUnstagedFiles: async () => Promise.reject('restoreUnstagedFiles fail'),
        cleanUp: async () => Promise.resolve(),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch {
    is(
      stdout.out,
      '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
        '\x1B[32m√\x1B[39m Backing up unstaged changes for staged files\n' +
        '\x1B[32m√\x1B[39m Applying modifications from tasks\n' +
        '\x1B[31m×\x1B[39m Restoring unstaged changes for staged files\n' +
        '\x1B[32m√\x1B[39m Cleaning up temporary to patch files\n'
    )
  }
})

test('should restoreOriginalState error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.reject('backupUnstagedFiles fail'),
        restoreOriginalState: async () => Promise.reject('restoreOriginalState fail'),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch {
    is(
      stdout.out,
      '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
        '\x1B[31m×\x1B[39m Backing up unstaged changes for staged files\n' +
        '\x1B[31m×\x1B[39m Restoring to original state because of errors\n'
    )
  }
})

test('should restoreOriginalState error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.reject('Task runner error'),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.resolve(),
        restoreOriginalState: async () => Promise.resolve(),
        cleanUp: async () => Promise.resolve(),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch (error) {
    equal(error, ['Task runner error'])
    is(
      stdout.out,
      '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
        '\x1B[32m√\x1B[39m Backing up unstaged changes for staged files\n' +
        '\x1B[32m√\x1B[39m Restoring to original state because of errors\n' +
        '\x1B[32m√\x1B[39m Cleaning up temporary to patch files\n'
    )
  }
})

test('should cleanUp error', async () => {
  const git_paths = { root: 'dir', dot: 'dir/.git' }
  const files = { working: ['a.js'], deleted: [], changed: ['a.js'] }

  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/cmd-runner.js': {
      createCmdRunner: () => ({
        generateCmdTasks: async () => [{ file_count: 1 }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.resolve(),
        applyModifications: async () => Promise.resolve(),
        restoreUnstagedFiles: async () => Promise.resolve(),
        cleanUp: async () => Promise.reject(),
      }),
    },
  })

  try {
    await createRunner({ stream: stdout, git_paths, files }).run()
  } catch {
    is(
      stdout.out,
      '\x1B[32m√\x1B[39m Preparing nano-staged\n' +
        '\x1B[32m√\x1B[39m Backing up unstaged changes for staged files\n' +
        '\x1B[32m√\x1B[39m Applying modifications from tasks\n' +
        '\x1B[32m√\x1B[39m Restoring unstaged changes for staged files\n' +
        '\x1B[31m×\x1B[39m Cleaning up temporary to patch files\n'
    )
  }
})

test.run()
