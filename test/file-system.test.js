import { equal, is } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'

async function fsMock() {
  return await esmock('../lib/file.js', {
    fs: {
      promises: {
        async unlink(path = null) {
          return Promise[path ? 'resolve' : 'reject'](path)
        },

        async readFile(path = null) {
          return Promise[path ? 'resolve' : 'reject'](path)
        },
      },
    },
  })
}

test('should reported path correctly', async () => {
  let { unlink } = await fsMock()
  let path = 'a.js'
  let result = await unlink(path)

  is(result, path)
})

test('should reported path correctly', async () => {
  let { read } = await fsMock()
  let path = 'a.js'
  let result = await read(path)

  equal(result, path)
})

test('should "null" when path is not found', async () => {
  let { read } = await fsMock()
  let result = await read()

  equal(result, null)
})

test.run()
