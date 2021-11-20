import { equal } from 'uvu/assert'
import { resolve } from 'path'
import { test } from 'uvu'

import { prepareFiles } from './index.js'
import { CHANGED_CODE, DELETED_CODE, STAGED_CODE } from '../git/index.js'

let config = {
  '*.{css,js}': ['prettier --write'],
  '*.md': ['prettier --write'],
  '../*.txt': ['prettier --write'],
}
let entries = [
  { path: 'a.js', type: STAGED_CODE, rename: undefined },
  { path: 'b.js', type: CHANGED_CODE, rename: undefined },
  { path: 'c.css', type: STAGED_CODE, rename: undefined },
  { path: 'd.md', type: CHANGED_CODE, rename: undefined },
  { path: 'e.css', type: DELETED_CODE, rename: undefined },
  { path: 'f.ts', type: STAGED_CODE, rename: undefined },
  { path: '../j.txt', type: STAGED_CODE, rename: undefined },
  { path: 'a/b/c/j.js', type: STAGED_CODE, rename: undefined },
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
      ['*.{css,js}', resolve(process.cwd(), 'a/b/c/j.js')],
      ['*.md', resolve(process.cwd(), 'd.md')],
      ['../*.txt', resolve(process.cwd(), '../j.txt')],
    ],
    stagedFiles: resolvePaths(['a.js', 'b.js', 'c.css', 'e.css', 'a/b/c/j.js', 'd.md', '../j.txt']),
    deletedFiles: resolvePaths(['e.css']),
    changedFiles: resolvePaths(['b.js', 'd.md']),
  })
})

test.run()
