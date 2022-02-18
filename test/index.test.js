import { is } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('should return when config undefined', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => undefined,
    },
  })

  try {
    await nanoStaged({ stream: stdout })
  } catch (error) {
    is(stdout.out, '\x1B[31m×\x1B[39m \x1B[31mCreate Nano Staged config.\x1B[39m\n')
  }
})

test('should return when config path error', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => undefined,
    },
  })

  try {
    await nanoStaged({ stream: stdout, config: 'config.json' })
  } catch (error) {
    is(
      stdout.out,
      '\x1B[31m×\x1B[39m \x1B[31mNano Staged config file \x1B[33mconfig.json\x1B[31m is not found.\x1B[39m\n'
    )
  }
})

test('should config invalid', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
    },
  })

  try {
    await nanoStaged({ stream: stdout })
  } catch (error) {
    is(stdout.out, '\x1B[31m×\x1B[39m \x1B[31mNano Staged config invalid.\x1B[39m\n')
  }
})

test('should return when git not found', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },

    '../lib/git.js': {
      createGit: () => ({
        getGitPaths: async () => ({ root: null, dot: null }),
      }),
    },
  })

  try {
    await nanoStaged({ stream: stdout })
  } catch (error) {
    is(error.message, 'Nano Staged didn’t find git directory.')
  }
})

test('should return when no files found for staged/unstaged/diff', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },

    '../lib/git.js': {
      createGit: () => ({
        getGitPaths: async () => ({ root: 'dir', dot: 'dir/.git' }),
        unstagedFiles: async () => ({ working: [], deleted: [], changed: [] }),
        stagedFiles: async () => ({ working: [], deleted: [], changed: [] }),
        changedFiles: async () => ({ working: [], deleted: [], changed: [] }),
      }),
    },
  })

  try {
    await nanoStaged({ stream: stdout })
  } catch (error) {
    is(error.message, 'No staged files found.')
    stdout.out = ''
  }

  try {
    await nanoStaged({ stream: stdout, unstaged: true })
  } catch (error) {
    is(error.message, 'No unstaged files found.')
    stdout.out = ''
  }

  try {
    await nanoStaged({ stream: stdout, diff: ['1', '2'] })
  } catch (error) {
    is(error.message, 'No diff files found.')
    stdout.out = ''
  }
})

test('should staged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
      getGitPaths: async () => ({ root: 'dir', dot: 'dir/.git' }),
    },

    '../lib/git.js': {
      createGit: () => ({
        getGitPaths: async () => ({ root: 'dir', dot: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },

    '../lib/runner.js': {
      createRunner: () => ({
        run: async () => stdout.write('staged'),
      }),
    },
  })

  await nanoStaged({ stream: stdout })
  is(stdout.out, 'staged')
})

test('should unstaged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },

    '../lib/git.js': {
      createGit: () => ({
        getGitPaths: async () => ({ root: 'dir', dot: 'dir/.git' }),
        unstagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },

    '../lib/runner.js': {
      createRunner: () => ({
        run: async () => stdout.write('unstaged'),
      }),
    },
  })

  await nanoStaged({ stream: stdout, unstaged: true })
  is(stdout.out, 'unstaged')
})

test('should diff runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },

    '../lib/git.js': {
      createGit: () => ({
        getGitPaths: async () => ({ root: 'dir', dot: 'dir/.git' }),
        changedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },

    '../lib/runner.js': {
      createRunner: () => ({
        run: async () => stdout.write('diff'),
      }),
    },
  })

  await nanoStaged({ stream: stdout, diff: [] })
  is(stdout.out, 'diff')
})

test('should runner run error', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },

    '../lib/git.js': {
      createGit: () => ({
        getGitPaths: async () => ({ root: 'dir', dot: 'dir/.git' }),
        stagedFiles: async () => ({ working: ['a.js'], deleted: [], changed: ['a.js'] }),
      }),
    },

    '../lib/runner.js': {
      createRunner: () => ({
        run: async () => {
          let taskError = new Error('Task error')
          taskError.name = 'TaskError'

          throw taskError
        },
      }),
    },
  })

  try {
    await nanoStaged({ stream: stdout })
  } catch (error) {
    is(stdout.out, '\n\x1B[31mTask error\x1B[39m\n')
  }
})

test.run()
