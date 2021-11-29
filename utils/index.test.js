import { equal, is } from 'uvu/assert'
import { test } from 'uvu'

import { toArray, showVersion, argvStrToArr } from './index.js'
import { createStdout } from '../test/utils/index.js'

test('single to array', () => {
  equal(toArray('path'), ['path'])
  equal(toArray(['path', 'path2']), ['path', 'path2'])
})

test('print version', () => {
  let stdout = createStdout()
  showVersion(stdout.write)
  is(stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'), 'Nano Staged \x1B[1mv0.1.0\x1B[22m')
})

test('string to args', () => {
  equal(argvStrToArr('nano-staged --config config-path --unstaged'), [
    'nano-staged',
    '--config',
    'config-path',
    '--unstaged',
  ])
  equal(argvStrToArr('npx prettier --check'), ['npx', 'prettier', '--check'])
  equal(argvStrToArr(''), [])
  equal(argvStrToArr(), [])
})

test.run()
