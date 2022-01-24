import { is, equal } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('should return when git not found', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: null, dotGitPath: null }),
      }),
    },
  })

  let runner = await createRunner({ stream: stdout })
  try {
    await runner.run()
  } catch (error) {
    is(error.message, 'Nano Staged didn’t find git directory.')
  }
})

test('should return when no files found for staged/unstaged/diff', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        unstagedFiles: async () => ({ working: [], deleted: [], changed: [] }),
        stagedFiles: async () => ({ working: [], deleted: [], changed: [] }),
        changedFiles: async () => ({ working: [], deleted: [], changed: [] }),
      }),
    },
  })

  let runner = await createRunner({ stream: stdout })

  try {
    await runner.run()
  } catch (error) {
    is(error.message, 'No staged files found.')
    stdout.out = ''
  }

  try {
    await runner.run('unstaged')
  } catch (error) {
    is(error.message, 'No unstaged files found.')
    stdout.out = ''
  }

  try {
    await runner.run('diff')
  } catch (error) {
    is(error.message, 'No diff files found.')
    stdout.out = ''
  }
})

test('should return when no files match any configured task', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: [] }],
      }),
    },
  })

  let runner = await createRunner({ stream: stdout })

  try {
    await runner.run()
  } catch (error) {
    is(error.message, 'No files match any configured task.')
  }
})

test('should step success', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
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

  let runner = await createRunner({ stream: stdout })

  await runner.run()

  is(
    stdout.out,
    '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Running tasks for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Applying modifications from tasks...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Restoring unstaged changes for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Removing temporary to patch files...\n'
  )
})

test('should backupOriginalState error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.reject('backupOriginalState fail'),
      }),
    },
  })

  let runner = await createRunner({ stream: stdout })

  await runner.run()
  is(
    stdout.out,
    '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Preparing nano-staged...\n\x1B[31mbackupOriginalState fail\x1B[39m\n'
  )
})

test('should backupUnstagedFiles error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
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

  let runner = await createRunner({ stream: stdout })

  await runner.run()
  is(
    stdout.out,
    '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
      '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[31mbackupUnstagedFiles fail\x1B[39m\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Restoring to its original state...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Removing temporary to patch files...\n'
  )
})

test('should applyModifications error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
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

  let runner = await createRunner({ stream: stdout })

  await runner.run()
  is(
    stdout.out,
    '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Running tasks for staged files...\n' +
      '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Applying modifications from tasks...\n' +
      '\x1B[31mapplyModifications fail\x1B[39m\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Restoring to its original state...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Removing temporary to patch files...\n'
  )
})

test('should restoreUnstagedFiles error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
        run: async () => Promise.resolve(),
      }),
    },
    '../lib/git-workflow.js': {
      createGitWorkflow: () => ({
        backupOriginalState: async () => Promise.resolve(),
        backupUnstagedFiles: async () => Promise.resolve(),
        applyModifications: async () => Promise.resolve(),
        restoreUnstagedFiles: async () => Promise.reject('restoreUnstagedFiles fail'),
        restoreOriginalState: async () => Promise.resolve(),
        cleanUp: async () => Promise.resolve(),
      }),
    },
  })

  let runner = await createRunner({ stream: stdout })

  await runner.run()
  is(
    stdout.out,
    '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Running tasks for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Applying modifications from tasks...\n' +
      '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Restoring unstaged changes for staged files...\n' +
      '\x1B[31mrestoreUnstagedFiles fail\x1B[39m\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Restoring to its original state...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Removing temporary to patch files...\n'
  )
})

test('should restoreOriginalState error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
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

  let runner = await createRunner({ stream: stdout })

  await runner.run()
  is(
    stdout.out,
    '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
      '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[31mbackupUnstagedFiles fail\x1B[39m\n' +
      '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Restoring to its original state...\n' +
      '\x1B[31mrestoreOriginalState fail\x1B[39m\n'
  )
})

test('should restoreOriginalState error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
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

  let runner = await createRunner({ stream: stdout })

  try {
    await runner.run()
  } catch (error) {
    is(error, 'Task runner error')
    is(
      stdout.out,
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
        '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
        '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Running tasks for staged files...\n' +
        '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Restoring to its original state...\n' +
        '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Removing temporary to patch files...\n'
    )
  }
})

test('should cleanUp error', async () => {
  const { createRunner } = await esmock('../lib/runner.js', {
    '../lib/git.js': {
      createGit: () => ({
        getRepoAndDotGitPaths: async () => ({ repoPath: 'dir', dotGitPath: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },
    '../lib/task-runner.js': {
      createTaskRunner: () => ({
        tasks: [{ files: ['a.js'] }],
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

  let runner = await createRunner({ stream: stdout })

  await runner.run()
  is(
    stdout.out,
    '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Preparing nano-staged...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Backing up unstaged changes for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Running tasks for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Applying modifications from tasks...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Restoring unstaged changes for staged files...\n' +
      '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Removing temporary to patch files...\n'
  )
})

test.run()
