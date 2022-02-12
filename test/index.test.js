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

test('should staged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
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
    is(stdout.out, '\n\x1B[31m×\x1B[39m \x1B[31mTask error\x1B[39m\n')
  }
})

test.run()
