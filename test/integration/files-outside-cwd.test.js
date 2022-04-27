import * as assert from 'uvu/assert'
import { suite } from 'uvu'
import path from 'path'

import { pretty_js, ugly_js } from './fixtures/files.js'
import { prettier_write } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'

const test = suite()

test.before.each(async (ctx) => {
  try {
    ctx.rig = new NanoStagedTestRig()
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

test('does not care about staged file outside current cwd with another staged file', async ({
  rig,
}) => {
  try {
    await rig.write('file.js', ugly_js)
    await rig.write('deeper/file.js', ugly_js)
    await rig.write('deeper/.nano-staged.json', JSON.stringify(prettier_write))
    await rig.git.exec(['add', '.'])

    await rig.commit({ cwd: path.join(rig.temp, 'deeper') })

    assert.is(await rig.read('deeper/file.js'), pretty_js)
    assert.is(await rig.read('file.js'), ugly_js)
  } catch (error) {
    console.log(error)
  }
})

test('not care about staged file outside current cwd without any other staged files', async ({
  rig,
}) => {
  try {
    await rig.write('file.js', ugly_js)
    await rig.write('deeper/.nano-staged.json', JSON.stringify(prettier_write))
    await rig.git.exec(['add', '.'])

    await rig.commit({ cwd: path.join(rig.temp, 'deeper') })
  } catch (error) {
    assert.match(error, 'Create Nano Staged config.')
    assert.is(await rig.read('file.js'), ugly_js)
  }
})

test.run()
