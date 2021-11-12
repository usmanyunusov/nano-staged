import { ok } from 'uvu/assert'
import { join } from 'path'
import { test } from 'uvu'

import { loadConfig, validConfig } from './index.js'

let cwd = join(process.cwd(), 'test/fixtures/config')

test('track load config correctly', async () => {
  let config = await loadConfig(cwd)
  ok(config)
})

test('track valid config correctly', async () => {
  let config = await loadConfig(cwd)
  ok(validConfig(config))
})

test.run()
