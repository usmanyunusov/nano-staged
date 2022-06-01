import { equal, is } from 'uvu/assert'
import process from 'process'
import { test } from 'uvu'
import tty from 'tty'
import os from 'os'

import { to_array, str_argv_to_array, get_force_color_level } from '../../lib/utils.js'

test.before.each(() => {
  Object.defineProperty(process, 'platform', {
    value: 'linux',
  })
  process.env = {}
  process.argv = []
  tty.isatty = () => true
})

test('single to array', () => {
  equal(to_array('path'), ['path'])
  equal(to_array(['path']), ['path'])
})

test('string to args', () => {
  equal(str_argv_to_array('cmd --test config --test'), ['cmd', '--test', 'config', '--test'])
  equal(str_argv_to_array(''), [])
  equal(str_argv_to_array(), [])
})

test('FORCE_COLOR: 1', () => {
  process.env = { FORCE_COLOR: '1' }
  is(get_force_color_level(), 1)

  process.env = { FORCE_COLOR: '' }
  is(get_force_color_level(), 0)

  process.env = { FORCE_COLOR: '256' }
  is(get_force_color_level(), 3)

  process.env = { FORCE_NO_COLOR: true }
  is(get_force_color_level(), 0)
})

test('tty.isatty: false', () => {
  tty.isatty = () => false
  is(get_force_color_level(), 0)
})

test('Windows 10 build 10586', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  Object.defineProperty(process.versions, 'node', {
    value: '8.0.0',
  })
  os.release = () => '10.0.10586'

  is(get_force_color_level(), 2)
})

test('Windows 10 build 14931', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  Object.defineProperty(process.versions, 'node', {
    value: '8.0.0',
  })
  os.release = () => '10.0.14931'

  is(get_force_color_level(), 3)
})

test('Windows 10 build 10586', () => {
  Object.defineProperty(process, 'platform', {
    value: 'win32',
  })
  Object.defineProperty(process.versions, 'node', {
    value: '8.0.0',
  })
  os.release = () => '10.0.10240'

  is(get_force_color_level(), 1)
})

test('COLORTERM', () => {
  process.env = { COLORTERM: true }
  is(get_force_color_level(), 1)
})

test('COLORTERM:truecolor', () => {
  process.env = { COLORTERM: 'truecolor' }
  is(get_force_color_level(), 3)
})

test('TERM:dumb', () => {
  process.env = { TERM: 'dumb' }
  is(get_force_color_level(), 0)
})

test('TERM:xterm-256color', () => {
  process.env = { TERM: 'xterm-256color' }
  is(get_force_color_level(), 2)
})

test('TERM:screen-256color', () => {
  process.env = { TERM: 'screen-256color' }
  is(get_force_color_level(), 2)
})

test('support putty-256color', () => {
  process.env = { TERM: 'putty-256color' }
  is(get_force_color_level(), 2)
})

test('TERM:rxvt', () => {
  process.env.TERM = 'rxvt'
  is(get_force_color_level(), 1)
})

test('default', () => {
  is(get_force_color_level(), 0)
})

test('prefer level 2/xterm over COLORTERM', () => {
  process.env = { COLORTERM: '1', TERM: 'xterm-256color' }
  is(get_force_color_level(), 2)
})

test('return level 1 when `TERM` is set to dumb when `FORCE_COLOR` is set', () => {
  process.env = { FORCE_COLOR: '1', TERM: 'dumb' }
  is(get_force_color_level(), 1)
})

test('--no-color', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--no-colors']
  is(get_force_color_level(), 0)
})

test('--no-colors', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--no-colors']
  is(get_force_color_level(), 0)
})

test('-color=false', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--color=false']
  is(get_force_color_level(), 0)
})

test('--color=never', () => {
  process.env = { TERM: 'xterm-256color' }
  process.argv = ['--color=never']
  is(get_force_color_level(), 0)
})

test.run()
