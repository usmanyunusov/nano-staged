import { promises as baseFs } from 'fs'
import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { fixture } from '../test/utils/index.js'
import { fileSystem } from './index.js'

let exampleFiles = [
  {
    path: fixture('fs/a.js.test'),
    content: 'let a = 1;',
  },
  {
    path: fixture('fs/b.css.test'),
    content: 'a {color: red;}',
  },
]

test('should write correctly files', async () => {
  let fs = fileSystem()
  await fs.write(exampleFiles)
  let has = exampleFiles.every(async ({ path }) => await baseFs.access(path))

  equal(has, true)
})

test('should read correctly files', async () => {
  let fs = fileSystem()
  let files = await fs.read([fixture('fs/a.js'), fixture('fs/b.css')])

  equal(files.length, 2)
})

test('should delete correctly files', async () => {
  let fs = fileSystem()
  await fs.delete(exampleFiles.map(({ path }) => path))
  let files = await fs.read(exampleFiles.map(({ path }) => path))

  equal(files.length, 0)
})

test('should not read file', async () => {
  let fs = fileSystem()
  let files = await fs.read([fixture('fs/a_null.js'), fixture('fs/b_null.css')])

  equal(files.length, 0)
})

test.run()
