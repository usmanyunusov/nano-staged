import { equal, is } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'

async function fsMock() {
  let { fileSystem } = await esmock('./index.js', {
    fs: {
      promises: {
        async unlink(path = null) {
          return Promise[path ? 'resolve' : 'reject'](path)
        },

        async readFile(path = null) {
          return Promise[path ? 'resolve' : 'reject'](path)
        },

        async writeFile(path = null, content = null) {
          return Promise[path ? 'resolve' : 'reject']({ path, content })
        },
      },
    },
  })

  return fileSystem()
}

test('delete file', async () => {
  let fs = await fsMock()
  let path = 'a.js'
  let result = await fs.delete(path)

  is(result, path)
})

test('delete file list', async () => {
  let fs = await fsMock()
  let paths = ['a.js', 'b.js']
  let result = await fs.delete(paths)

  equal(result, paths)
})

test('read file', async () => {
  let fs = await fsMock()
  let path = 'a.js'
  let result = await fs.read(path)

  equal(result, path)
})

test('not read file', async () => {
  let fs = await fsMock()
  let result = await fs.read()

  equal(result, null)
})

test('read file list', async () => {
  let fs = await fsMock()
  let result = await fs.read(['a.js', 'b.js'])

  equal(result, [
    { path: 'a.js', content: 'a.js' },
    { path: 'b.js', content: 'b.js' },
  ])
})

test('not read file list', async () => {
  let fs = await fsMock()
  let result = await fs.read([null, null])

  equal(result, [])
})

test('write file', async () => {
  let fs = await fsMock()
  let files = [
    { path: 'a.js', content: 'a.js' },
    { path: 'b.js', content: 'b.js' },
  ]
  let result = await fs.write(files)

  equal(result, files)
})

test('write file list', async () => {
  let fs = await fsMock()
  let path = 'a.js'
  let content = 'a.js'
  let result = await fs.write(path, content)

  equal(result, { path, content })
})

test.run()
