import { is, equal } from 'uvu/assert'
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
    repoPath: 'test',
    files: ['a.js', '../../b.css'],
    config: { '*.js': ['prettier --write'], '../*.css': 'prettier --write' },
    stream: stdout,
  })

  equal(runner.tasks, [
    {
      files: ['/Users/odmin/Desktop/Dev/github-projects/nano-staged/test/a.js'],
      pattern: '*.js',
      type: 'staged',
      cmds: ['prettier --write'],
    },
    {
      files: ['/Users/odmin/Desktop/Dev/github-projects/b.css'],
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
    is(error.message, '\x1B[31m*.js prettier --write:\n\x1B[39mRun error')
  }
})

test.run()
