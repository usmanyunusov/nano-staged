import { is, equal } from 'uvu/assert'
import { join } from 'path'
import esmock from 'esmock'
import { test } from 'uvu'

import { createStdout, fixture, makeDir, writeFile, removeFile } from './utils/index.js'

let stdout = createStdout()
const cwd = fixture('simple/runner-test')
const srcDir = fixture('simple/runner-test/src/foo')

test.before.each(async () => {
  stdout.out = ''

  await makeDir(srcDir)
  await writeFile('a.js', 'const a = 1;\n', srcDir)
  await writeFile('b.js', 'const b = 1;\n', srcDir)
  await writeFile('b.css', 'body { color: red; }\n', cwd)
})

test.after.each(async () => {
  await removeFile(cwd)
})

test('should create runner and resolve tasks', async () => {
  const { createCmdRunner } = await esmock('../lib/cmd-runner.js')

  let runner = createCmdRunner({
    rootPath: srcDir,
    cwd: srcDir,
    files: ['a.js', '../../b.css'],
    config: { '*.js': ['prettier --write'], '../*.css': 'prettier --write' },
    stream: stdout,
  })

  const cmdTasks = await runner.generateCmdTasks()

  is(
    JSON.stringify(cmdTasks),
    JSON.stringify([
      {
        title: '*.js\u001b[2m - 1 file\u001b[22m',
        file_count: 1,
        tasks: [{ title: 'prettier --write', pattern: '*.js' }],
      },
      { title: '../*.css\u001b[2m - no files\u001b[22m', file_count: 0, tasks: [] },
    ]),
  )
})

test('should run handle error', async () => {
  const { createCmdRunner } = await esmock('../lib/cmd-runner.js', {
    '../lib/executor.js': {
      executor: async () => Promise.reject('Run error'),
    },
  })

  let runner = await createCmdRunner({
    rootPath: srcDir,
    cwd: srcDir,
    files: ['a.js', '../../b.css'],
    config: { '*.js': ['prettier --write', 'prettier --write'], '*.css': () => 'prettier --write' },
    stream: stdout,
  })

  const cmdTasks = await runner.generateCmdTasks()
  const task = { tasks: cmdTasks }

  try {
    await runner.run(task)
  } catch (error) {
    is(
      error.message,
      '\x1B[31m*.js\x1B[39m \x1B[2m>\x1B[22m \x1B[31mprettier --write\x1B[39m:\nRun error',
    )
    equal(
      task.tasks.map((t) => ({ state: t.state })),
      [{ state: 'fail' }, { state: 'warn' }],
    )
  }
})

test('should run handle success', async () => {
  const { createCmdRunner } = await esmock('../lib/cmd-runner.js', {
    '../lib/executor.js': {
      executor: async () => Promise.resolve('Run done'),
    },
  })

  let runner = await createCmdRunner({
    rootPath: srcDir,
    cwd: srcDir,
    files: ['a.js', 'b.js', '../../b.css'],
    config: { '*.js': ['prettier --write', 'prettier --write'], '*.css': () => 'prettier --write' },
    stream: stdout,
  })

  const cmdTasks = await runner.generateCmdTasks()
  const task = { tasks: cmdTasks }

  await runner.run(task)

  equal(
    task.tasks.map((t) => ({ state: t.state })),
    [{ state: 'done' }, { state: 'warn' }],
  )
})

test.run()
