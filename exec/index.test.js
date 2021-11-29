import { is } from 'uvu/assert'
import { test } from 'uvu'

import { exec } from './index.js'
import { fixture } from '../test/utils/index.js'

test('spawn success', async () => {
  let cwd = fixture('utils/success.js')

  let output = await exec('node', [cwd])
  is(output, 'Spawn test\n')
})

test('spawn fail', async () => {
  let cwd = fixture('utils/fail.js')

  try {
    await spawn('node', [cwd])
  } catch (error) {
    is(!!error, true)
  }
})

test.run()
