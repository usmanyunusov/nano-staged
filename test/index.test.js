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
    is(
      stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
      'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
        '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31mCreate Nano Staged config.\x1B[39m\n'
    )
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
      stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
      'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
        '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31mNano Staged config file \x1B[33mconfig.json\x1B[31m is not found.\x1B[39m\n'
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
    is(
      stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
      'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
        '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31mNano Staged config invalid.\x1B[39m\n'
    )
  }
})

test('should staged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => stdout.write('staged'),
      }),
    },
  })

  await nanoStaged({ stream: stdout })
  is(stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'), 'Nano Staged \x1B[1mv0.1.0\x1B[22m\nstaged')
})

test('should unstaged runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => stdout.write('unstaged'),
      }),
    },
  })

  await nanoStaged({ stream: stdout, unstaged: true })
  is(stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'), 'Nano Staged \x1B[1mv0.1.0\x1B[22m\nunstaged')
})

test('should diff runner', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
        run: async () => stdout.write('diff'),
      }),
    },
  })

  await nanoStaged({ stream: stdout, diff: [] })
  is(stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'), 'Nano Staged \x1B[1mv0.1.0\x1B[22m\ndiff')
})

test('should runner run error', async () => {
  const nanoStaged = await esmock('../lib/index.js', {
    '../lib/config.js': {
      getConfig: async () => true,
      validConfig: async () => true,
    },
    '../lib/runner.js': {
      createRunner: async () => ({
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
    is(
      stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'),
      'Nano Staged \x1B[1mv0.1.0\x1B[22m\n' +
        '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31mTask error\x1B[39m\n'
    )
  }
})

test.run()
