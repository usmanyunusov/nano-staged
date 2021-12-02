import { equal, is } from 'uvu/assert'
import { join } from 'path'
import { test } from 'uvu'

import { fileSystem } from '../lib/file-system.js'
import { fixture } from './utils/index.js'

let cwd = fixture('simple')

test('to file', async () => {
  let fs = fileSystem()

  await fs.write(join(cwd, 'a.js'), 'let a = {};')
  is((await fs.read(join(cwd, 'a.js'))).toString(), 'let a = {};')
  is(await fs.read(join(cwd, 'c.js')), null)
  await fs.delete(join(cwd, 'a.js'))
})

test('to file list', async () => {
  let fs = fileSystem()

  await fs.write([
    {
      path: join(cwd, 'a.js'),
      content: 'let a = {};',
    },
    {
      path: join(cwd, 'b.js'),
      content: 'let b = {};',
    },
  ])

  equal(
    (await fs.read([join(cwd, 'a.js'), join(cwd, 'c.js')])).map(({ content }) =>
      content.toString()
    ),
    ['let a = {};']
  )
  equal(
    (await fs.read([join(cwd, 'a.js'), join(cwd, 'c.js')])).map(({ path }) => path),
    [join(cwd, 'a.js')]
  )
  await fs.delete([join(cwd, 'a.js'), join(cwd, 'b.js')])
})

test.run()
