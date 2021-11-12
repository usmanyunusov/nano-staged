import { fileURLToPath } from 'url'
import { equal } from 'uvu/assert'
import { test } from 'uvu'
import { dirname, resolve } from 'path'

import { fileSystem } from './index.js'

let currentDir = dirname(fileURLToPath(import.meta.url))
let example = [
  {
    path: resolve(currentDir, '../test/fixtures/fs/a.js.test'),
    source: 'let a = 1;',
  },
  {
    path: resolve(currentDir, '../test/fixtures/fs/b.css.test'),
    source: 'a {color: red;}',
  },
]

test('track fs correctly', async () => {
  let fs = fileSystem()

  await fs.write(example)

  let sources = await fs.read([
    resolve(currentDir, '../test/fixtures/fs/a.js'),
    resolve(currentDir, '../test/fixtures/fs/b.css'),
  ])
  equal(sources.length, 2)

  let isOk = sources.every(
    ({ path, source }, i) =>
      path + '.test' === example[i].path && source.toString() === example[i].source
  )
  equal(isOk, true)

  await fs.delete(example.map(({ path }) => path))
  let deleteFiles = await fs.read(example.map(({ path }) => path))

  equal(deleteFiles.length, 0)
})

test('track fs read not file', async () => {
  let fs = fileSystem()

  let sources = await fs.read([
    resolve(currentDir, '../test/fixtures/fs/a_null.js'),
    resolve(currentDir, '../test/fixtures/fs/b_null.css'),
  ])

  equal(sources, [])
})

test.run()
