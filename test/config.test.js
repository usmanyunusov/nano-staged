import { equal, is } from 'uvu/assert'
import { homedir } from 'os'
import esmock from 'esmock'
import { join } from 'path'
import { test } from 'uvu'

import { fixture } from './utils/index.js'
import { loadConfig, validConfig } from '../lib/config.js'

test('cwd null', async () => {
  is(await loadConfig(join(homedir(), 'test')), undefined)
})

test('found package.json with config', async () => {
  equal(await loadConfig(fixture('config/pkg-with-config')), {
    '*': 'my-tasks',
  })
})

test('found package.json without config', async () => {
  is(await loadConfig(fixture('config/pkg-without-config')), undefined)
})

test('not found package.json', async () => {
  is(await loadConfig(undefined), undefined)
})

test('resolve package.json', async () => {
  const { loadConfig } = await esmock('../lib/config.js', {
    fs: {
      promises: {
        async readFile() {
          return Promise.reject()
        },
      },
    },
  })

  is(await loadConfig(), undefined)
})

test('find config in parent dirs', async () => {
  let config = await loadConfig(fixture('config/pkg-parent/pkg-child/pkg-child-child'))
  equal(config, { '*': 'my-tasks' })
})

test('find nano-staged.json config', async () => {
  let config = await loadConfig(fixture('config/json-config'))
  equal(config, { '*': 'my-json-tasks' })
})

test('find .nano-staged.json config', async () => {
  let config = await loadConfig(fixture('config/dot-json-config'))
  equal(config, { '*': 'my-json-dot-tasks' })
})

test('find .nano-staged.js config', async () => {
  let config = await loadConfig(fixture('config/dot-js-config'))
  equal(config['*'](), 'my-dot-js-tasks')
})

test('find nano-staged.js config', async () => {
  let config = await loadConfig(fixture('config/js-config'))
  equal(config['*'](), 'my-js-tasks')
})

test('find .nano-staged.mjs config', async () => {
  let config = await loadConfig(fixture('config/dot-mjs-config'))
  equal(config['*'](), 'my-dot-mjs-tasks')
})

test('find nano-staged.mjs config', async () => {
  let config = await loadConfig(fixture('config/mjs-config'))
  equal(config['*'](), 'my-mjs-tasks')
})

test('find .nano-staged.cjs config', async () => {
  let config = await loadConfig(fixture('config/dot-cjs-config'))
  equal(config['*'](), 'my-dot-cjs-tasks')
})

test('find nano-staged.cjs config', async () => {
  let config = await loadConfig(fixture('config/cjs-config'))
  equal(config['*'](), 'my-cjs-tasks')
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
