import { is, equal } from 'uvu/assert'
import { test } from 'uvu'
import { delay } from 'nanodelay'

import { createRenderer } from '../lib/renderer.js'
import { createStdout } from './utils/index.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('should create is TTY renderer', async () => {
  const renderer = createRenderer(stdout)
  const task = {
    title: 'Test',
    tasks: [
      {
        title: 'Sub test',
      },
    ],
  }

  renderer.spin(task)
  task.state = 'run'

  renderer.spin(task)
  task.state = 'warn'

  renderer.spin(task)
  task.state = 'done'

  renderer.spin(task)
  task.state = 'fail'

  renderer.stop()

  is(
    stdout.out,
    '\x1B[90m*\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[33m\\\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[33m|\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[33m↓\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[33m↓\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[33m↓\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[32m√\x1B[39m Test\n' +
      '\x1B[32m√\x1B[39m Test\n' +
      '\x1B[32m√\x1B[39m Test\n' +
      '\x1B[32m√\x1B[39m Test\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[1A\x1B[1G\x1B[2K\x1B[31m×\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[31m×\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[31m×\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[31m×\x1B[39m Test\n' +
      '  \x1B[90m*\x1B[39m Sub test\n' +
      '\x1B[?25h'
  )
})

test('should create is CI renderer', async () => {
  const renderer = createRenderer(stdout, { isTTY: false })
  const tasks = [
    {
      title: 'Test',
      state: 'done',
    },
    {
      title: 'Test 2',
      state: 'done',
      tasks: [
        {
          title: 'Sub test',
          state: 'done',
          tasks: [
            {
              title: 'Sub sub test',
              state: 'done',
              parent: {
                title: 'Sub test',
              },
            },
          ],
        },
      ],
    },
  ]

  for (const task of tasks) {
    renderer.spin(task)
  }

  renderer.stop()

  is(
    stdout.out,
    '\x1B[32m√\x1B[39m Test\n\x1B[32m√\x1B[39m Sub test\x1B[33m ≫ \x1B[39mSub sub test\n'
  )
})

test.run()
