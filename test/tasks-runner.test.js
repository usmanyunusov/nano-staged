import { is, equal } from 'uvu/assert'
import { homedir } from 'os'
import { join } from 'path'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'
import { MultiSpinner } from '../lib/spinner.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('should create runner and resolve tasks', async () => {
  const { createTasksRunner } = await esmock('../lib/tasks-runner.js')

  let runner = await createTasksRunner({
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
  const { createTasksRunner } = await esmock('../lib/tasks-runner.js', {
    '../lib/executor.js': {
      executor: async () => Promise.reject('Run error'),
    },
  })

  let runner = await createTasksRunner({
    repoPath: 'test',
    files: ['a.js', '../../b.css'],
    config: { '*.js': ['prettier --write', 'prettier --write'], '*.css': () => 'prettier --write' },
    stream: stdout,
  })

  const spinner = new MultiSpinner({ stream: stdout })

  try {
    await runner.run(spinner)
  } catch (error) {
    is(stdout.out, '\x1B[?25l\x1B[33m\\\x1B[39m *.js\x1B[2m - 1 file\x1B[22m')
  } finally {
    spinner.stop()
  }
})

test.run()
