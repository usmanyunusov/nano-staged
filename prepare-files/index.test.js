import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { prepareFiles } from './index.js'

let config = { '*.{css,js}': ['prettier --write'] }
let entries = [
  { path: 'a.js', type: 1 },
  { path: 'b.js', type: 2 },
  { path: 'c.css', type: 1 },
  { path: 'd.md', type: 4 },
  { path: 'e.css', type: 4 },
]

test(`shoulds prepare correctly files`, () => {
  let files = prepareFiles(entries, config)

  equal(files, {
    tasks: [
      [
        {
          pattern: '*.{css,js}',
          cmd: 'prettier --write',
          files: ['a.js', 'b.js', 'c.css', 'e.css'],
        },
      ],
    ],
    staged: ['a.js', 'b.js', 'c.css', 'e.css'],
    deleted: ['e.css'],
    changed: ['b.js'],
  })
})

test.run()
