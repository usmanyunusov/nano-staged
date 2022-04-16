import { equal, is } from 'uvu/assert'
import { homedir } from 'os'
import esmock from 'esmock'
import { join } from 'path'
import { test } from 'uvu'

import { getConfig, validConfig } from '../lib/config.js'
import { fixture } from './utils/index.js'

test('should return "undefined" when config file is not found', async () => {
  is(await getConfig(join(homedir(), 'test')), undefined)
})

test('should load config from "package.json"', async () => {
  equal(await getConfig(fixture('config/test-project/dir')), {
    '*': 'my-tasks',
  })
})

test('should return "object" config', async () => {
  equal(await getConfig(process.cwd(), { '*': 'my-tasks' }), {
    '*': 'my-tasks',
  })
})

test('should load JSON config file', async () => {
  let config = await getConfig(fixture('config/json'))
  equal(config, { '*': 'my-tasks' })
})

test('should load EMS config file from .js file', async () => {
  let config = await getConfig(fixture('config/esm-in-js'))
  equal(config['*'](), 'my-tasks')
})

test('should load EMS config file from .mjs file', async () => {
  let config = await getConfig(fixture('config/mjs'))
  equal(config['*'](), 'my-tasks')
})

test('should load CJS config file from .cjs file', async () => {
  let config = await getConfig(fixture('config/cjs'))
  equal(config, { '*': 'my-tasks' })
})

test('should load CJS config file from absolute path', async () => {
  let config = await getConfig(process.cwd(), fixture('config/cjs/nano-staged.cjs'))
  equal(config, { '*': 'my-tasks' })
})

test('should load CJS config file from relative path', async () => {
  let config = await getConfig(
    process.cwd(),
    join('test', 'fixtures', 'config', 'cjs', 'nano-staged.cjs')
  )
  equal(config, { '*': 'my-tasks' })
})

test('should load no extension config file', async () => {
  let config = await getConfig(fixture('config/no-ext'))
  equal(config, { '*': 'my-tasks' })
})

test('should return "undefined" when error', async () => {
  const { getConfig } = await esmock('../lib/config.js', {
    fs: {
      promises: {
        readFile: async () => Promise.reject(),
      },
    },
  })

  is(await getConfig(), undefined)
})

test('config undefined', async () => {
  is(validConfig(), false)
})

test('config empty', async () => {
  is(validConfig({}), false)
})

test('config single cmd', async () => {
  is(
    validConfig({
      '*': 'my-tasks',
    }),
    true
  )
})

test('config array cmds', async () => {
  is(
    validConfig({
      '*': ['my-tasks'],
    }),
    true
  )
})

test('config glob empty', async () => {
  is(
    validConfig({
      '': ['my-tasks'],
    }),
    false
  )
})

test('config single cmd empty', async () => {
  is(
    validConfig({
      '*': '',
    }),
    false
  )
})

test('config array cmds empty', async () => {
  is(
    validConfig({
      '*': ['', ''],
    }),
    false
  )
})

test('config cmd not string', async () => {
  is(
    validConfig({
      '': 1,
    }),
    false
  )
})

test('config glob and cmd empty', async () => {
  is(
    validConfig({
      '': '',
    }),
    false
  )
})

test('config one task invalid', async () => {
  is(
    validConfig({
      '*': '',
      '*.js': 'my-task',
    }),
    false
  )
})

test.run()
