import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { glob as baseGlob } from './index.js'

let files = [
  'a.js',
  '/a.js',
  'test/a.js',
  'test/a1.js',
  '/test/a1.js',
  'even/test/a.js',
  '/even/test/a.js',
  '.hidden/test.js',

  'b.css',
  '/b.css',
  'test/b.css',
  'test/b1.css',
  '/test/b1.css',
  'even/test/b.css',
  '/even/test/b.css',
  '.hidden/test.css',

  'c.md',
  '/c.md',
  'test/c.md',
  'test/c1.md',
  '/test/c1.md',
  'even/test/c.md',
  '/even/test/c.md',
  '.hidden/test.md',

  'https://nanostaged.github.com',
  './1.num1',
  './2.num2',
]

let match = (glob, str, opts = {}) => {
  let res = baseGlob(glob, {
    filepath: true,
    extended: true,
    ...opts,
  })
  return res.regex.test(str)
}

test('find files to *.ext', () => {
  let matches = files.filter((path) => match('*.js', path))
  equal(matches, [
    'a.js',
    '/a.js',
    'test/a.js',
    'test/a1.js',
    '/test/a1.js',
    'even/test/a.js',
    '/even/test/a.js',
    '.hidden/test.js',
  ])
})

test('find files to **.ext', () => {
  let matches = files.filter((path) => match('**.js', path))
  equal(matches, [
    'a.js',
    '/a.js',
    'test/a.js',
    'test/a1.js',
    '/test/a1.js',
    'even/test/a.js',
    '/even/test/a.js',
    '.hidden/test.js',
  ])
})

test('find files to **/*.ext', () => {
  let matches = files.filter((path) => match('**/*.js', path))
  equal(matches, [
    '/a.js',
    'test/a.js',
    'test/a1.js',
    '/test/a1.js',
    'even/test/a.js',
    '/even/test/a.js',
    '.hidden/test.js',
  ])
})

test('find files to /**/*.ext', () => {
  let matches = files.filter((path) => match('/**/*.js', path))
  equal(matches, ['/test/a1.js', '/even/test/a.js'])
})

test('find files to ?.ext', () => {
  equal(
    files.filter((path) => match('?.js', path)),
    ['a.js']
  )
  equal(
    files.filter((path) => match('?.css', path)),
    ['b.css']
  )
})

test('find files to *.{ext_1,ext_2}', () => {
  let matches = files.filter((path) => match('*.{js,css}', path))
  equal(matches, [
    'a.js',
    '/a.js',
    'test/a.js',
    'test/a1.js',
    '/test/a1.js',
    'even/test/a.js',
    '/even/test/a.js',
    '.hidden/test.js',
    'b.css',
    '/b.css',
    'test/b.css',
    'test/b1.css',
    '/test/b1.css',
    'even/test/b.css',
    '/even/test/b.css',
    '.hidden/test.css',
  ])
})

test('find files to *.name.domen', () => {
  let matches = files.filter((path) => match('*.github.com', path))
  equal(matches, ['https://nanostaged.github.com'])
})

test('find files to ./[0-9].*', () => {
  let matches = files.filter((path) => match('./[0-9].*', path))
  equal(matches, ['./1.num1', './2.num2'])
})

test('find files to !(*test).js', () => {
  let files = [
    'test.js',
    'index.js',
    'index.test.js',
    'src/main.js',
    'src/api/get.js',
    'src/main.test.js',
    'src/api/get.test.js',
    'src/test.js',
  ]

  let matches = files.filter((path) => match('!(*test).js', path))
  equal(matches, ['index.js'])
})

test('find files to !(*test).js', () => {
  let files = [
    'test.js',
    'index.js',
    'index.test.js',
    'src/main.js',
    'src/api/get.js',
    'src/main.test.js',
    'src/api/get.test.js',
    'src/test.js',
  ]

  let matches = files.filter((path) => match('!(*.test).js', path))
  equal(matches, ['test.js', 'index.js'])
})

test('find files to !(*test).js', () => {
  let files = [
    'test.js',
    'index.js',
    'index.test.js',
    'src/main.js',
    'src/api/get.js',
    'src/main.test.js',
    'src/api/get.test.js',
    'src/test.js',
  ]
})

test.run()
