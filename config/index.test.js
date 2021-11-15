import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
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

  equal(config, undefined)
})

test('should validate config correctly', async () => {
  equal(validConfig(), false)

  equal(validConfig({}), false)

  equal(
    validConfig({
      '*': 'my-tasks',
    }),
    true
  )

  equal(
    validConfig({
      '*': ['my-tasks'],
    }),
    true
  )

  equal(
    validConfig({
      '': ['my-tasks'],
    }),
    false
  )

  equal(
    validConfig({
      '*': 1,
    }),
    false
  )

  equal(
    validConfig({
      '*': '',
    }),
    false
  )

  equal(
    validConfig({
      '*': ['', ''],
    }),
    false
  )

  equal(
    validConfig({
      '*': ['', ''],
    }),
    false
  )

  equal(
    validConfig({
      '': '',
    }),
    false
  )

  equal(
    validConfig({
      '*': '',
      '*.js': 'my-task',
    }),
    false
  )
})

test.run()
