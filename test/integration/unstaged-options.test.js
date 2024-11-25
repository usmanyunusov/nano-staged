import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { pretty_js, ugly_js } from './fixtures/files.js'
import { NanoStagedTestRig } from './utils/test-rig.js'
import { prettier_write } from './fixtures/configs.js'

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

test('linting unstaged files when with `--unstaged`', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_write))

  await rig.write('test.js', pretty_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.write('test.js', ugly_js)
  await rig.write('test2.js', ugly_js)

  rig.no_commit = true

  await rig.commit({
    nano_staged: ['-u'],
  })

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')
  assert.is(await rig.read('test.js'), pretty_js)
  assert.is(await rig.read('test2.js'), pretty_js)
})

test.run()
