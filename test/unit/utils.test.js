import { equal } from 'uvu/assert'
import process from 'process'
import { test } from 'uvu'
import tty from 'tty'

import { to_array, str_argv_to_array } from '../../lib/utils.js'

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

test.run()
