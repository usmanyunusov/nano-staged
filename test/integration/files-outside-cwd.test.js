import * as assert from 'uvu/assert'
import * as path from 'path'
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

test('does not care about staged file outside current cwd with another staged file', async ({
  rig,
}) => {
  await rig.write('file.js', ugly_js)
  await rig.write('deeper/file.js', ugly_js)
  await rig.write('deeper/.nano-staged.json', JSON.stringify(prettier_write))
  await rig.git.exec(['add', '.'])

  await rig.commit(undefined, path.join(rig.temp, 'deeper'))

  assert.is(await rig.read('deeper/file.js'), pretty_js)
  assert.is(await rig.read('file.js'), ugly_js)
})

test('not care about staged file outside current cwd without any other staged files', async ({
  rig,
}) => {
  await rig.write('file.js', ugly_js)
  await rig.write('deeper/.nano-staged.json', JSON.stringify(prettier_write))
  await rig.git.exec(['add', '.'])

  await rig.commit(undefined, path.join(rig.temp, 'deeper')).then((result) => {
    assert.match(result, 'No files match any configured task.')
  })

  assert.is(await rig.read('file.js'), ugly_js)
})

test.run()
