import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { test } from 'uvu'
import { dirname, resolve } from 'path'
import { promises as baseFs } from 'fs'

import { fileSystem } from './index.js'

let dir = dirname(fileURLToPath(import.meta.url))
let example = [
  {
    path: resolve(dir, '../test/fixtures/fs/a.js.test'),
    source: 'let a = 1;',
  },
  {
    path: resolve(dir, '../test/fixtures/fs/b.css.test'),
    source: 'a {color: red;}',
  },
]

test('should write correctly files', async () => {
  let fs = fileSystem()
  await fs.write(example)

  let hasFiles = example.every(async ({ path }) => await baseFs.access(path))
  equal(hasFiles, true)
})

test('should read correctly files', async () => {
  let fs = fileSystem()
  let sources = await fs.read([
    resolve(dir, '../test/fixtures/fs/a.js'),
    resolve(dir, '../test/fixtures/fs/b.css'),
  ])
  equal(sources.length, 2)
})

test('should delete correctly files', async () => {
  let fs = fileSystem()
  await fs.delete(example.map(({ path }) => path))

  let deleteFiles = await fs.read(example.map(({ path }) => path))
  equal(deleteFiles.length, 0)
})

test('should not read file', async () => {
  let fs = fileSystem()
  let sources = await fs.read([
    resolve(dir, '../test/fixtures/fs/a_null.js'),
    resolve(dir, '../test/fixtures/fs/b_null.css'),
  ])

  equal(sources.length, 0)
})

test.run()
