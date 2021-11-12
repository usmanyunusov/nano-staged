import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { dirname, resolve } from 'path'
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
  equal(toAbsolute('../index.css', '/app/src'), '/app/index.css')
})

test('util: toRelative', () => {
  equal(toRelative('./app/test/index.css', './app'), 'test/index.css')
})

test('util: findUp', () => {
  let cwd = resolve(currentDir, '../test/fixtures/config')
  let pkgDir = findUp(cwd, 'package.json')
  let noPkgDir = findUp(cwd, 'packasge.json')

  equal(!!pkgDir, true)
  equal(noPkgDir, undefined)
})

test('util: showVersion', () => {
  showVersion(stdout.write)
  equal(stdout.out, 'Nano Staged \x1B[1mv0.1.0\x1B[22m')
})

test('util: stringToArgv', () => {
  let argv = stringToArgv('cmd --test config --test')
  equal(argv, ['cmd', '--test', 'config', '--test'])
})

test('util: spawn', async () => {
  let cwd = resolve(currentDir, '../test/fixtures/utils/spawn.js')

  let output = await spawn('node', [cwd])
  equal(output, 'Spawn test\n')
})

test.run()
