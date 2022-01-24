import { is } from 'uvu/assert'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'
import { createReporter } from '../lib/create-reporter.js'
import { NanoStagedError } from '../lib/error.js'

let stdout = createStdout()
let { step, error } = createReporter({ stream: stdout })

test.before.each(() => {
  stdout.out = ''
})

test('should reported step correctly', () => {
  step('Run step')
  is(stdout.out, '\x1B[32m\x1B[1m√\x1B[22m\x1B[39m Run step...\n')
})

test('should reported step when error correctly', () => {
  step('Run step', new Error('Error'))
  is(stdout.out, '\x1B[31m\x1B[1m×\x1B[22m\x1B[39m Run step...\n\x1B[31mError\x1B[39m\n')
})

test('should reported error correctly', () => {
  let err = new Error('Error')

  error(err)
  is(stdout.out, '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31mError\x1B[39m\n')
})

test('should reported TaskRunnerError correctly', () => {
  let err = new Error('TaskRunnerError')
  err.name = 'TaskRunnerError'

  error(err)
  is(stdout.out, '\nTaskRunnerError\n')
})

test('should reported NanoStagedError correctly', () => {
  error(new NanoStagedError('noFiles'))
  is(stdout.out, '\x1B[36m-\x1B[39m No undefined files found.\n')

  stdout.out = ''
  error(new NanoStagedError('invalidConfig'))
  is(stdout.out, '\x1B[41m\x1B[30m ERROR \x1B[39m\x1B[49m \x1B[31mNano Staged config invalid.\x1B[39m\n')
})

test.run()
