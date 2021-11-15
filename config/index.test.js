import { equal, type, is } from 'uvu/assert'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { test } from 'uvu'

import { loadConfig, validConfig } from './index.js'

const DIRNAME = dirname(fileURLToPath(import.meta.url))

function fixture(name) {
  return resolve(DIRNAME, '../test/fixtures', name)
}

test('should load config correctly', async () => {
  let cwd = fixture('config/has')
  let config = await loadConfig(cwd)

  equal(config, {
    '*': 'my-tasks',
  })
})

test('should fail load config', async () => {
  let cwd = fixture('config/not')
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
