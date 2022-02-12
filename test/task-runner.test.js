import { is, equal } from 'uvu/assert'
import { homedir } from 'os'
import { join } from 'path'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'
import { Spinner } from '../lib/spinner.js'

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
      cmdFn: false,
      files: [join(homedir(), 'test/a.js')],
      pattern: '*.js',
      type: 'staged',
      cmds: ['prettier --write'],
    },
    {
      cmdFn: false,
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

  const spinner = new Spinner({ stream: stdout })

  await runner.run(spinner)

  spinner.stop()
})

test.run()
