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

test('find file to *.ext', () => {
  let matches = files.filter((path) =>
    match('*.js', path, { globstar: true, filepath: true, extended: true })
  )

  equal(matches, ['a.js'])
})

test('find file to **/*.ext', () => {
  let matches = files.filter((path) =>
    match('**/*.js', path, { globstar: true, filepath: true, extended: true })
  )

  equal(matches, ['a.js', 'test/a.js', 'test/a1.js', 'even/test/a.js', '.hidden/test.js'])
})

test('find file to *.{css,js}', () => {
  let matches = files.filter((path) =>
    match('*.{css,js,md}', path, { globstar: true, filepath: true, extended: true })
  )

  equal(matches, ['a.js', 'b.css', 'c.md'])
})

test('find file to .hidden/*.js', () => {
  let matches = files.filter((path) =>
    match('.hidden/*.js', path, { globstar: true, filepath: true, extended: true })
  )

  equal(matches, ['.hidden/test.js'])
})

test.run()
