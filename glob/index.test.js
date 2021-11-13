import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { glob as baseGlob } from './index.js'

let files = [
  'a.js',
  'test/a.js',
  'test/a1.js',
  'even/test/a.js',
  '.hidden/test.js',

  'b.css',
  'test/b.css',
  'test/b1.css',
  'even/test/b.css',
  '.hidden/test.css',

  'c.md',
  'test/c.md',
  'test/c1.md',
  'even/test/c.md',
  '.hidden/test.md',
]

let match = (glob, str, opts = {}) => {
  let res = baseGlob(glob, opts)
  return res.regex.test(str)
}

test('track globrex on *.ext', () => {
  let jsFiles = files.filter((path) => match('*.js', path, { extended: true }))
  equal(jsFiles, ['a.js', 'test/a.js', 'test/a1.js', 'even/test/a.js', '.hidden/test.js'])
})

test('track globrex on **/*.ext', () => {
  let jsFiles = files.filter((path) => match('**/*.js', path, { extended: true }))
  equal(jsFiles, ['test/a.js', 'test/a1.js', 'even/test/a.js', '.hidden/test.js'])
})

test('track globrex on *.{css,js}', () => {
  let jsCssFiles = files.filter((path) => match('*.{css,js}', path, { extended: true }))
  equal(jsCssFiles, [
    'a.js',
    'test/a.js',
    'test/a1.js',
    'even/test/a.js',
    '.hidden/test.js',
    'b.css',
    'test/b.css',
    'test/b1.css',
    'even/test/b.css',
    '.hidden/test.css',
  ])
})

test('track globrex on .hidden/*.js', () => {
  let jsCssFiles = files.filter((path) => match('.hidden/*.js', path, { extended: true }))
  equal(jsCssFiles, ['.hidden/test.js'])
})

test.run()
