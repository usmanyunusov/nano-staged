import { equal, is } from 'uvu/assert'
import { homedir } from 'os'
import esmock from 'esmock'
import { join } from 'path'
import { test } from 'uvu'

import { get_config, valid_config } from '../../lib/config.js'
import { fixture } from './utils/index.js'

test('should return "undefined" when config file is not found', async () => {
  is(await get_config(join(homedir(), 'test')), undefined)
})

test('should load config from "package.json"', async () => {
  equal(await get_config(fixture('config/test-project/dir')), {
    '*': 'my-tasks',
  })
})

test('should return "object" config', async () => {
  equal(await get_config(process.cwd(), { '*': 'my-tasks' }), {
    '*': 'my-tasks',
  })
})

test('should load JSON config file', async () => {
  let config = await get_config(fixture('config/json'))
  equal(config, { '*': 'my-tasks' })
})

test('should load EMS config file from .js file', async () => {
  let config = await get_config(fixture('config/esm-in-js'))
  equal(config['*'](), 'my-tasks')
})

test('should load EMS config file from .mjs file', async () => {
  let config = await get_config(fixture('config/mjs'))
  equal(config['*'](), 'my-tasks')
})

test('should load CJS config file from .cjs file', async () => {
  let config = await get_config(fixture('config/cjs'))
  equal(config, { '*': 'my-tasks' })
})

test('should load CJS config file from absolute path', async () => {
  let config = await get_config(process.cwd(), fixture('config/cjs/nano-staged.cjs'))
  equal(config, { '*': 'my-tasks' })
})

test('should load CJS config file from relative path', async () => {
  let config = await get_config(
    process.cwd(),
    join('test', 'unit', 'fixtures', 'config', 'cjs', 'nano-staged.cjs')
  )
  equal(config, { '*': 'my-tasks' })
})

test('should load no extension config file', async () => {
  let config = await get_config(fixture('config/no-ext'))
  equal(config, { '*': 'my-tasks' })
})

test('should return "undefined" when error', async () => {
  const { get_config } = await esmock('../../lib/config.js', {
    fs: {
      promises: {
        readFile: async () => Promise.reject(),
      },
    },
  })

  is(await get_config(), undefined)
})

test('config undefined', async () => {
  is(valid_config(), false)
})

test('config empty', async () => {
  is(valid_config({}), false)
})

test('config single cmd', async () => {
  is(valid_config({ '*': 'my-tasks' }), true)
})

test('config array cmds', async () => {
  is(valid_config({ '*': ['my-tasks'] }), true)
})

test('config glob empty', async () => {
  is(valid_config({ '': ['my-tasks'] }), false)
})

test('config single cmd empty', async () => {
  is(valid_config({ '*': '' }), false)
})

test('config array cmds empty', async () => {
  is(valid_config({ '*': ['', ''] }), false)
})

test('config cmd not string', async () => {
  is(valid_config({ '': 1 }), false)
})

test('config glob and cmd empty', async () => {
  is(valid_config({ '': '' }), false)
})

test('config one task invalid', async () => {
  is(valid_config({ '*': '', '*.js': 'my-task' }), false)
})

test.run()
