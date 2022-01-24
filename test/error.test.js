import { is } from 'uvu/assert'
import { test } from 'uvu'

import { NanoStagedError } from '../lib/error.js'
import { createStdout } from './utils/index.js'

let stdout = createStdout()

test.before.each(() => {
  stdout.out = ''
})

test('has mark', () => {
  let err = new NanoStagedError('noConfig')
  is(err.name, 'NanoStagedError')
})

test('has message', () => {
  let err = new NanoStagedError('noConfig')
  is(err.message, 'Create Nano Staged config.')
})

test('has type', () => {
  let err = new NanoStagedError('noConfig')
  is(err.type, 'noConfig')
})

test('has error for unknown option', () => {
  let err = new NanoStagedError('noFileConfig', 'no-config.js')
  is(err.message, 'Nano Staged config file *no-config.js* is not found.')
})

test.run()
