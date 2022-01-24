import { is, equal } from 'uvu/assert'
import { homedir } from 'os'
import { join } from 'path'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('should create runner and resolve tasks', async () => {
  const { createTaskRunner } = await esmock('../lib/task-runner.js')

  let runner = await createTaskRunner({
    repoPath: join(homedir(), 'test'),
    cwd: join(homedir(), 'test'),
    files: ['a.js', '../../b.css'],
    config: { '*.js': ['prettier --write'], '../*.css': 'prettier --write' },
    stream: stdout,
  })

  equal(runner.tasks, [
    {
      files: [join(homedir(), 'test/a.js')],
      pattern: '*.js',
      type: 'staged',
      cmds: ['prettier --write'],
    },
    {
      files: [],
      pattern: '../*.css',
      type: 'staged',
      cmds: ['prettier --write'],
    },
  ])
})

test('should run handle error', async () => {
  const { createTaskRunner } = await esmock('../lib/task-runner.js', {
    '../lib/spawner.js': {
      spawner: async () => Promise.reject('Run error'),
    },
  })

  let runner = await createTaskRunner({
    repoPath: 'test',
    files: ['a.js', '../../b.css'],
    config: { '*.js': ['prettier --write', 'prettier --write'], '*.css': () => 'prettier --write' },
    stream: stdout,
  })

  try {
    await runner.run()
  } catch (error) {
    is(
      error.message,
      '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31m*.js prettier --write\x1B[39m:\nRun error'
    )
  }
})

test.run()
