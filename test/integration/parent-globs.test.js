import * as assert from 'uvu/assert'
import * as path from 'path'
import { suite } from 'uvu'

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

test('works with parent glob "../*.js"', async ({ rig }) => {
  await rig.write('file.js', '')
  await rig.write('deeper/file.js', '')
  await rig.write('deeper/even/file.js', '')
  await rig.write('deeper/even/deeper/file.js', '')
  await rig.write('a/very/deep/file/path/file.js', '')
  await rig.git.exec(['add', '.'])
  await rig.write(
    'deeper/even/.nano-staged.js',
    `module.exports = { '../*.js': ({ filenames }) => filenames.map((f) => \`echo level-2 > \${f}\`) }`
  )
  await rig.commit({ nano_staged: ['--shell', '-d'] }, path.join(rig.temp, 'deeper/even'))

  assert.match(await rig.read('file.js'), '')
  assert.match(await rig.read('deeper/file.js'), 'level-2')
  assert.match(await rig.read('deeper/even/file.js'), '')
  assert.match(await rig.read('deeper/even/deeper/file.js'), '')
  assert.match(await rig.read('a/very/deep/file/path/file.js'), '')
})

test.run()
