import { equal, is } from 'uvu/assert'
import { test } from 'uvu'

import { toArray, findUp, showVersion, stringToArgv, spawn } from './index.js'
import { fixture, createStdout } from '../test/utils/index.js'

test('single to array', () => {
  equal(toArray('path'), ['path'])
})

test('found file dir', () => {
  let cwd = fixture('config/pkg-with-config')
  let pkgPath = findUp('package.json', cwd)
  let pkgNotPath = findUp('not-package.json', cwd)

  is(pkgPath, cwd)
  is(pkgNotPath, undefined)
})

test('print version', () => {
  let stdout = createStdout()
  showVersion(stdout.write)
  is(stdout.out.replace(/\d+\.\d+\.\d+/, '0.1.0'), 'Nano Staged \x1B[1mv0.1.0\x1B[22m')
})

test('string to args', () => {
  equal(stringToArgv('cmd --test config --test'), ['cmd', '--test', 'config', '--test'])
  equal(stringToArgv(''), [])
  equal(stringToArgv(), [])
})

test('spawn success', async () => {
  let cwd = fixture('utils/success.js')

  let output = await spawn('node', [cwd])
  is(output, 'Spawn test\n')
})

test('spawn fail', async () => {
  let cwd = fixture('utils/fail.js')

  try {
    await spawn('node', [cwd])
  } catch (error) {
    is(!!error, true)
  }
})

test.run()
