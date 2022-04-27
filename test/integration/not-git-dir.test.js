import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { NanoStagedTestRig } from './utils/test-rig.js'

const test = suite()

test.before.each(async (ctx) => {
  try {
    ctx.rig = new NanoStagedTestRig()
    ctx.rig.with_git = false
    await ctx.rig.setup()
  } catch (e) {
    console.error('uvu before error', e)
    process.exit(1)
  }
})

test.after.each(async (ctx) => {
  try {
    await ctx.rig.remove(ctx.rig.temp)
  } catch (e) {
    console.error('uvu after error', e)
    process.exit(1)
  }
})

test('fails when not in a git directory', async ({ rig }) => {
  try {
    await rig.write('.nano-staged.json', JSON.stringify({ '*.js': 'prettier --write' }))
    await rig.commit()
  } catch (error) {
    assert.match(error, 'Nano Staged didn’t find git directory.')
  }
})

test.run()
