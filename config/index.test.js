import { equal, type, is } from 'uvu/assert'
import { test } from 'uvu'
import { realpathSync } from 'fs'
import { resolve } from 'path'
import os from 'os'

import { loadConfig, validConfig } from './index.js'
import { fixture } from '../test/utils/index.js'

let osTmpDir = process.env.APPVEYOR ? 'C:\\projects' : realpathSync(os.tmpdir())

test('should load config correctly', async () => {
  let cwd = fixture('config/has')
  let config = await loadConfig(cwd)

  equal(config, {
    '*': 'my-tasks',
  })
})

test('should fail load config', async () => {
  let cwd = resolve(osTmpDir, `nano-staged`)
  let config = await loadConfig(cwd)

  type(config, 'undefined')
})

test('should validate config correctly', async () => {
  is(validConfig(), false)

  is(validConfig({}), false)

  is(
    validConfig({
      '*': 'my-tasks',
    }),
    true
  )

  is(
    validConfig({
      '*': ['my-tasks'],
    }),
    true
  )

  is(
    validConfig({
      '': ['my-tasks'],
    }),
    false
  )

  is(
    validConfig({
      '*': 1,
    }),
    false
  )

  is(
    validConfig({
      '*': '',
    }),
    false
  )

  is(
    validConfig({
      '*': ['', ''],
    }),
    false
  )

  is(
    validConfig({
      '*': ['', ''],
    }),
    false
  )

  is(
    validConfig({
      '': '',
    }),
    false
  )

  is(
    validConfig({
      '*': '',
      '*.js': 'my-task',
    }),
    false
  )
})

test.run()
