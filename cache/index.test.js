import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { setCache, getCache, delCache, clearCache, getAllCache } from './index.js'

test('track cache', () => {
  setCache('a.js', 1)
  equal(getCache('a.js'), 1)

  delCache('a.js')
  equal(getCache('a.js'), undefined)

  setCache('a.js', 1)
  equal(getAllCache().size, 1)

  clearCache()
  equal(getAllCache().size, 0)

  setCache('a.js', 1)
  setCache('a.js', 2)
  equal(getCache('a.js'), 2)
})

test.run()
