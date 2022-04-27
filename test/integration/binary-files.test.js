import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { prettier_list_diff } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'

const test = suite('integration')

test.before.each(async (ctx) => {
  try {
    ctx.rig = new NanoStagedTestRig()
    await ctx.rig.git_init()
  } catch (e) {
    console.error('uvu before error', e)
    process.exit(1)
  }
})

test.after.each(async (ctx) => {
  try {
    await ctx.rig.cleanup()
  } catch (e) {
    console.error('uvu after error', e)
    process.exit(1)
  }
})

test('handles binary files', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.write('.gitattributes', 'binary\n')
  await rig.write('binary', Buffer.from('Hello, World!', 'binary'))

  await rig.git.exec(['add', 'binary'])
  await rig.commit({ nano_staged: ['-d'] })

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is(Buffer.from(await rig.read('binary'), 'binary').toString(), 'Hello, World!')
})

test.run()
