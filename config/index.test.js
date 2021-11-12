import { equal } from 'uvu/assert'
import { join } from 'path'
import { test } from 'uvu'

import { loadConfig, validConfig } from './index.js'

let cwd = join(process.cwd(), 'test/fixtures/config')

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
  let config = await loadConfig(cwd)
  equal(validConfig(config), true)
})

test.run()
