import { is } from 'uvu/assert'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'
import { createReporter } from '../lib/create-reporter.js'
import { NanoStagedError, TaskRunnerError } from '../lib/error.js'

let stdout = createStdout()
let report = createReporter(stdout)

test.before.each(() => {
  stdout.out = ''
})

test('should reported error correctly', () => {
  let err = new Error('Error')

  report.error(err)
  is(stdout.out, '\n\x1B[31m×\x1B[39m \x1B[31mError\x1B[39m\n')
})

test('should reported TaskRunnerError correctly', () => {
  let err = new Error('TaskRunnerError')
  err.name = 'TaskRunnerError'

  report.error(err)
  is(stdout.out, '\n\x1B[31m×\x1B[39m \x1B[31mTaskRunnerError\x1B[39m\n')
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

test.run()
