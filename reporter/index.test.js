import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { reporter } from './index.js'

let stdout = { out: '' }
stdout.write = (symbols) => {
  stdout.out += symbols
}

test('track reporter correctly', () => {
  let { log, info, step } = reporter({ stream: stdout })

  log('Run test')
  equal(stdout.out, 'Run test\n')
  stdout.out = ''

  info('Run test')
  equal(stdout.out, '\x1B[36m-\x1B[39m Run test\n')
  stdout.out = ''

  step('Run test')
  equal(stdout.out, '\x1B[32m-\x1B[39m Run test...\n')
  stdout.out = ''
})

test.run()
