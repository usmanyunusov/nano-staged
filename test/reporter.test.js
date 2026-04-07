import { is } from 'uvu/assert'
import { test } from 'uvu'

import { NanoStagedError, TaskRunnerError } from '../lib/errors.js'
import { createReporter } from '../lib/reporter.js'
import { createStdout } from './utils/index.js'

let stdout = createStdout()
let report = createReporter(stdout)

test.before.each(() => {
  stdout.out = ''
})

test('should reported error correctly', () => {
  let err = new Error('Error')

  report.error(err)
  is(stdout.out, '\n\x1B[31mError\x1B[39m\n')
})

test('should reported TaskRunnerError correctly', () => {
  let err = new Error('TaskRunnerError')
  err.name = 'TaskRunnerError'

  report.error(err)
  is(stdout.out, '\n\x1B[31mTaskRunnerError\x1B[39m\n')
})

test('should reported NanoStagedError correctly', () => {
  report.error(new NanoStagedError('noFiles'))
  is(stdout.out, '\x1B[36m-\x1B[39m No undefined files found.\n')

  stdout.out = ''
  report.error(new TaskRunnerError('task error'))
  is(stdout.out, '\ntask error\n')

  stdout.out = ''
  report.error(new NanoStagedError('invalidConfig'))
  is(stdout.out, '\x1B[31m×\x1B[39m \x1B[31mNano Staged config invalid.\x1B[39m\n')
})

test('should fall back to err when message is empty for TaskRunnerError', () => {
  let err = new TaskRunnerError()
  report.error(err)
  is(stdout.out, `\n${err}\n`)
})

test('should fall back to err when message is empty for generic error', () => {
  report.error('raw error')
  is(stdout.out, `\n\x1B[31mraw error\x1B[39m\n`)
})

test.run()
