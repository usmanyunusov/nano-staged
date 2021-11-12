import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { loadConfig, validConfig } from './index.js'

test.before(async (context) => {
  let dir = dirname(fileURLToPath(import.meta.url))
  context.cwd = resolve(dir, '../test/fixtures/config')
})

test('should load config correctly', async ({ cwd }) => {
  let config = await loadConfig(cwd)
  equal(config, {
    '*': 'my-tasks',
  })
})

test('should failed load config', async () => {
  let config = await loadConfig()
  equal(config, undefined)
})

test('should validate config correctly', async () => {
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
      '*': '',
      '*.js': 'my-task',
    }),
    false
  )
})

test.run()
