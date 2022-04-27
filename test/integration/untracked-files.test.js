import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { invalid_js, pretty_js } from './fixtures/files.js'
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

test('ignores untracked files', async ({ rig }) => {
  await rig.append('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('test.js', pretty_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.append('test-untracked.js', pretty_js)
  await rig.append('.gitattributes', 'binary\n')
  await rig.write('binary', Buffer.from('Hello, World!', 'binary'))

  await rig.commit()

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is(await rig.read('test.js'), pretty_js)
  assert.is(await rig.read('test-untracked.js'), pretty_js)
  assert.is(Buffer.from(await rig.read('binary'), 'binary').toString(), 'Hello, World!')
})

test('ingores untracked files when task fails', async ({ rig }) => {
  await rig.append('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('test.js', invalid_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.append('test-untracked.js', pretty_js)
  await rig.append('.gitattributes', 'binary\n')
  await rig.write('binary', Buffer.from('Hello, World!', 'binary'))

  await rig.commit().catch(async () => {
    assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
    assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')
    assert.is(await rig.read('test.js'), invalid_js)
    assert.is(await rig.read('test-untracked.js'), pretty_js)
    assert.is(Buffer.from(await rig.read('binary'), 'binary').toString(), 'Hello, World!')
  })
})

test.run()
