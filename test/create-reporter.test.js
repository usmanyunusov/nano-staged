import { is } from 'uvu/assert'
import { test } from 'uvu'

import { createStdout } from './utils/index.js'
import { createReporter } from '../lib/create-reporter.js'

let stdout = createStdout()
let { log, info, step } = createReporter({ stream: stdout })

test.before.each(() => {
  stdout.out = ''
})

test('should reported log correctly', () => {
  log('Run log')
  is(stdout.out, 'Run log\n')
})

test('should reported info correctly', () => {
  info('Run info')
  is(stdout.out, '\x1B[36m-\x1B[39m Run info\n')
})

test('should reported step correctly', () => {
  step('Run step')
  is(stdout.out, '\x1B[32m\x1B[1m-\x1B[22m\x1B[39m Run step...\n')
})

test.run()
