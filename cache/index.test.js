import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { createCache } from './index.js'

test.before(async (context) => {
  context.cache = createCache()
})

test.after(async ({ cache }) => {
  cache.clear()
})

test('should cache correctly', async ({ cache }) => {
  cache.set('a.js', 1)
  equal(cache.get('a.js'), 1)

  cache.delete('a.js')
  equal(cache.get('a.js'), undefined)

  cache.set('a.js', 1)
  equal(cache.getAll().size, 1)

  cache.clear()
  equal(cache.getAll().size, 0)

  cache.set('a.js', 1)
  cache.set('a.js', 2)
  equal(cache.get('a.js'), 2)
})

test.run()
