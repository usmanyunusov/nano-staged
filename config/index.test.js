import { equal, is } from 'uvu/assert'
import { join } from 'path'
import esmock from 'esmock'
import { test } from 'uvu'
import os from 'os'

import { fixture } from '../test/utils/index.js'
import { loadConfig, validConfig } from './index.js'

test('cwd null', async () => {
  is(await loadConfig(join(os.homedir(), 'test')), undefined)
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
  const { loadConfig } = await esmock('./index.js', {
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
