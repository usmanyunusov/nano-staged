import { ok } from 'uvu/assert'
import { test } from 'uvu'
import { join } from 'path'

import { fileSystem } from './index.js'

let example = [
  {
    path: join(process.cwd(), 'test/fixtures/fs/a.js.test'),
    source: 'let a = 1;',
  },
  {
    path: join(process.cwd(), 'test/fixtures/fs/b.css.test'),
    source: 'a {color: red;}',
  },
]

test('track fs correctly', async () => {
  let fs = fileSystem()

  await fs.write(example)

  let sources = await fs.read([
    join(process.cwd(), 'test/fixtures/fs/a.js'),
    join(process.cwd(), 'test/fixtures/fs/b.css'),
  ])
  let isOk = sources.every(
    ({ path, source }, i) =>
      path + '.test' === example[i].path && source.toString() === example[i].source
  )

  ok(isOk)

  await fs.delete(example.map(({ path }) => path))
})

test.run()
