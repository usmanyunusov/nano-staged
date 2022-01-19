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
      loadConfig: async () => undefined,
    },
  })

  await nanoStaged({ stream: stdout })
  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.5.0\x1B[22m\n\x1B[36m-\x1B[39m Create Nano Staged config.\n'
  )
})

test('should return when config path error', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      loadConfig: async () => undefined,
    },
  })

  await nanoStaged({ stream: stdout, config: 'config.json' })
  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.5.0\x1B[22m\n' +
      '\x1B[36m-\x1B[39m Nano Staged config file \x1B[33mconfig.json\x1B[39m is not found.\n'
  )
})

test('should config invalid', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      loadConfig: async () => true,
    },
  })

  await nanoStaged({ stream: stdout })
  is(
    stdout.out,
    'Nano Staged \x1B[1mv0.5.0\x1B[22m\n\x1B[36m-\x1B[39m Nano Staged config invalid.\n'
  )
})

test('should staged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      loadConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => stdout.write('staged'),
      }),
    },
  })

  await nanoStaged({ stream: stdout })
  is(stdout.out, 'Nano Staged \x1B[1mv0.5.0\x1B[22m\nstaged')
})

test('should unstaged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      loadConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => stdout.write('unstaged'),
      }),
    },
  })

  await nanoStaged({ stream: stdout, unstaged: true })
  is(stdout.out, 'Nano Staged \x1B[1mv0.5.0\x1B[22m\nunstaged')
})

test('should diff runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      loadConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => stdout.write('diff'),
      }),
    },
  })

  await nanoStaged({ stream: stdout, diff: [] })
  is(stdout.out, 'Nano Staged \x1B[1mv0.5.0\x1B[22m\ndiff')
})

test('should runner run error', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      loadConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => {
          let taskError = new Error('task error')
          let runError = new Error('run error')
          taskError.name = 'TaskError'

          throw [taskError, runError]
        },
      }),
    },
  })

  try {
    await nanoStaged({ stream: stdout })
  } catch (error) {
    is(stdout.out, 'Nano Staged \x1B[1mv0.5.0\x1B[22m\n\ntask error\n\n\x1B[31mrun error\x1B[39m\n')
  }
})

test.run()
