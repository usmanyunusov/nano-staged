import { equal, is } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'

import { fixture } from '../test/utils/index.js'

test('found package.json with config', async () => {
  const { loadConfig } = await esmock('./index.js', {
    '../utils/index.js': {
      findUp: () => fixture('config/pkg-with-config'),
    },
  })

  let config = await loadConfig()
  equal(config, {
    '*': 'my-tasks',
  })
})

test('found package.json without config', async () => {
  const { loadConfig } = await esmock('./index.js', {
    '../utils/index.js': {
      findUp: () => fixture('config/pkg-without-config'),
    },
  })

  let config = await loadConfig()
  is(config, undefined)
})

test('not found package.json', async () => {
  const { loadConfig } = await esmock('./index.js', {
    '../utils/index.js': {
      findUp: () => undefined,
    },
  })

  let config = await loadConfig()
  is(config, undefined)
})

test('resolve package.json', async () => {
  const { loadConfig } = await esmock('./index.js', {
    '../utils/index.js': {
      findUp: () => fixture('config/pkg-with-config'),
    },
    fs: {
      promises: {
        async readFile() {
          return Promise.reject()
        },
      },
    },
  })

  let config = await loadConfig()
  is(config, undefined)
})

test('config undefined', async () => {
  const { validConfig } = await esmock('./index.js')
  is(validConfig(), false)
})

test('config empty', async () => {
  const { validConfig } = await esmock('./index.js')
  is(validConfig({}), false)
})

test('config single cmd', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '*': 'my-tasks',
    }),
    true
  )
})

test('config array cmds', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '*': ['my-tasks'],
    }),
    true
  )
})

test('config glob empty', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '': ['my-tasks'],
    }),
    false
  )
})

test('config single cmd empty', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '*': '',
    }),
    false
  )
})

test('config array cmds empty', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '*': ['', ''],
    }),
    false
  )
})

test('config cmd not string', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '': 1,
    }),
    false
  )
})

test('config glob and cmd empty', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '': '',
    }),
    false
  )
})

test('config one task invalid', async () => {
  const { validConfig } = await esmock('./index.js')
  is(
    validConfig({
      '*': '',
      '*.js': 'my-task',
    }),
    false
  )
})

test.run()
