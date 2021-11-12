import { equal } from 'uvu/assert'
import { test } from 'uvu'

import { reporter } from './index.js'

let stdout = { out: '' }
stdout.write = (symbols) => {
  stdout.out += symbols
}

test.after.each(() => {
  stdout.out = ''
})

test('should reported log correctly', () => {
  let { log } = reporter({ stream: stdout })

  log('Run log')
  equal(stdout.out, 'Run log\n')
})

test('should reported info correctly', () => {
  let { info } = reporter({ stream: stdout })

  info('Run info')
  equal(stdout.out, '\x1B[36m-\x1B[39m Run info\n')
})

test('should reported step correctly', () => {
  let { step } = reporter({ stream: stdout })

  step('Run step')
  equal(stdout.out, '\x1B[32m-\x1B[39m Run step...\n')
})

test.run()
