import { equal } from 'uvu/assert'
import { resolve } from 'path'
import { test } from 'uvu'

import { prepareFiles } from './index.js'

let config = { '*.{css,js}': ['prettier --write'], '*.md': ['prettier --write'] }
let entries = [
  { path: 'a.js', type: 1 },
  { path: 'b.js', type: 2 },
  { path: 'c.css', type: 1 },
  { path: 'd.md', type: 2 },
  { path: 'e.css', type: 4 },
  { path: 'f.ts', type: 1 },
  { path: '../j.txt', type: 1 },
]

test(`shoulds prepare correctly files`, () => {
  let files = prepareFiles({
    entries,
    config,
  })

  function resolvePaths(paths) {
    return paths.map((path) => resolve(process.cwd(), path))
  }
  equal(files, {
    taskedFiles: [
      ['*.{css,js}', resolve(process.cwd(), 'a.js')],
      ['*.{css,js}', resolve(process.cwd(), 'b.js')],
      ['*.{css,js}', resolve(process.cwd(), 'c.css')],
      ['*.{css,js}', resolve(process.cwd(), 'e.css')],
      ['*.md', resolve(process.cwd(), 'd.md')],
    ],
    stagedFiles: resolvePaths(['a.js', 'b.js', 'c.css', 'e.css', 'd.md']),
    deletedFiles: resolvePaths(['e.css']),
    changedFiles: resolvePaths(['b.js', 'd.md']),
  })
})

test.run()
