import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { equal, is } from 'uvu/assert'
import { test } from 'uvu'

import {
  toArray,
  toAbsolute,
  toRelative,
  findUp,
  showVersion,
  stringToArgv,
  spawn,
} from './index.js'

let stdout = { out: '' }
stdout.write = (symbols) => {
  stdout.out += symbols
}

let currentDir = dirname(fileURLToPath(import.meta.url))

test('util: toArray', () => {
  equal(toArray('path'), ['path'])
})

test('util: toAbsolute', () => {
  is(toAbsolute('../index.css', '/app/src'), '/app/index.css')
  is(toAbsolute('/app/src/index.css', '/app/src'), '/app/src/index.css')
})

test('util: toRelative', () => {
  is(toRelative('./app/test/index.css', './app'), 'test/index.css')
})

test('util: findUp', () => {
  let cwd = resolve(currentDir, '../test/fixtures/config')
  let rootPath = findUp('package.json', cwd)
  let noRootPath = findUp('not-package.json', cwd)

  is(!!rootPath, true)
  is(!!noRootPath, false)
})

test('util: showVersion', () => {
  showVersion(stdout.write)
  is(stdout.out, 'Nano Staged \x1B[1mv0.1.0\x1B[22m')
})

test('util: stringToArgv', () => {
  equal(stringToArgv('cmd --test config --test'), ['cmd', '--test', 'config', '--test'])
  equal(stringToArgv(''), [])
  equal(stringToArgv(), [])
})

test('util: spawn', async () => {
  let cwd = resolve(currentDir, '../test/fixtures/utils/spawn.js')

  let output = await spawn('node', [cwd])
  is(output, 'Spawn test\n')
})

test.run()
