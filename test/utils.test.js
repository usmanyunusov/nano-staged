import { equal, is } from 'uvu/assert'
import process from 'process'
import { test } from 'uvu'
import tty from 'tty'
import os from 'os'

import { toArray, stringArgvToArray, getForceColorLevel } from '../lib/utils.js'

test.before.each(() => {
  Object.defineProperty(process, 'platform', {
    value: 'linux',
  })
  process.env = {}
  process.argv = []
  tty.isatty = () => true
})

test('single to array', () => {
  equal(toArray('path'), ['path'])
  equal(toArray(['path']), ['path'])
})

test('string to args', () => {
  equal(stringArgvToArray('cmd --test config --test'), ['cmd', '--test', 'config', '--test'])
  equal(stringArgvToArray(''), [])
  equal(stringArgvToArray(), [])
})

test('FORCE_COLOR: 1', () => {
  process.env = { FORCE_COLOR: '1' }
  is(getForceColorLevel(), 1)

  process.env = { FORCE_COLOR: '' }
  is(getForceColorLevel(), 0)

  process.env = { FORCE_COLOR: '256' }
  is(getForceColorLevel(), 3)

  process.env = { FORCE_NO_COLOR: true }
  is(getForceColorLevel(), 0)
})

test('tty.isatty: false', () => {
  tty.isatty = () => false
  is(getForceColorLevel(), 0)
})

test('Windows 10 build 10586', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  Object.defineProperty(process.versions, 'node', {
    value: '8.0.0',
  })
  os.release = () => '10.0.10586'

  is(getForceColorLevel(), 2)
})

test('Windows 10 build 14931', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  Object.defineProperty(process.versions, 'node', {
    value: '8.0.0',
  })
  os.release = () => '10.0.14931'

  is(getForceColorLevel(), 3)
})

test('Windows 10 build 10586', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  Object.defineProperty(process.versions, 'node', {
    value: '8.0.0',
  })
  os.release = () => '10.0.10240'

  is(getForceColorLevel(), 1)
})

test('COLORTERM', () => {
  process.env = { COLORTERM: true }
  is(getForceColorLevel(), 1)
})

test('COLORTERM:truecolor', () => {
  process.env = { COLORTERM: 'truecolor' }
  is(getForceColorLevel(), 3)
})

test('TERM:dumb', () => {
  process.env = { TERM: 'dumb' }
  is(getForceColorLevel(), 0)
})

test('TERM:xterm-256color', () => {
  process.env = { TERM: 'xterm-256color' }
  is(getForceColorLevel(), 2)
})

test('TERM:screen-256color', () => {
  process.env = { TERM: 'screen-256color' }
  is(getForceColorLevel(), 2)
})

test('support putty-256color', () => {
  process.env = { TERM: 'putty-256color' }
  is(getForceColorLevel(), 2)
})

test('TERM:rxvt', () => {
  process.env.TERM = 'rxvt'
  is(getForceColorLevel(), 1)
})

test('default', () => {
  is(getForceColorLevel(), 0)
})

test('prefer level 2/xterm over COLORTERM', () => {
  process.env = { COLORTERM: '1', TERM: 'xterm-256color' }
  is(getForceColorLevel(), 2)
})

test('return level 1 when `TERM` is set to dumb when `FORCE_COLOR` is set', () => {
  process.env = { FORCE_COLOR: '1', TERM: 'dumb' }
  is(getForceColorLevel(), 1)
})

test('--no-color', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--no-colors']
  is(getForceColorLevel(), 0)
})

test('--no-colors', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--no-colors']
  is(getForceColorLevel(), 0)
})

test('-color=false', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--color=false']
  is(getForceColorLevel(), 0)
})

test('--color=never', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--color=never']
  is(getForceColorLevel(), 0)
})

test.run()
