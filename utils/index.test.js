import { equal, is } from 'uvu/assert'
import { test } from 'uvu'

import { toArray, showVersion, stringArgvToArray } from './index.js'
import { createStdout } from '../test/utils/index.js'

test('single to array', () => {
  equal(toArray('path'), ['path'])
})

test('print version', () => {
  let stdout = createStdout()
  showVersion(stdout.write)
  is(stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'), 'Nano Staged \x1B[1mv0.1.0\x1B[22m')
})

test('string to args', () => {
  equal(stringArgvToArray('cmd --test config --test'), ['cmd', '--test', 'config', '--test'])
  equal(stringArgvToArray(''), [])
  equal(stringArgvToArray(), [])
})

test.run()
