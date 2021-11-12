import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { dirname, resolve } from 'path'
import { test } from 'uvu'

import { loadConfig, validConfig } from './index.js'

let currentDir = dirname(fileURLToPath(import.meta.url))
let cwd = resolve(currentDir, '../test/fixtures/config')

test('track load config correctly', async () => {
  let config = await loadConfig(cwd)
  equal(config, {
    '*': 'my-tasks',
  })
})

test('track fail load config', async () => {
  let config = await loadConfig()
  equal(config, undefined)
})

test('track valid config correctly', async () => {
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
