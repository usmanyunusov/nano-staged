import * as assert from 'uvu/assert'
import { suite } from 'uvu'
import fs from 'fs-extra'
import path from 'path'

import { prettier_list_diff } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'
import { pretty_js, ugly_js } from './fixtures/files.js'

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

test('does not resurrect removed files due to git bug when tasks pass', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))

  await rig.remove('README.md')
  await rig.write('test.js', pretty_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.commit()

  assert.is(fs.existsSync(path.join(rig.temp, 'README.md')), false)
})

test('does not resurrect removed files in complex case', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.write('test.js', pretty_js)
  await rig.git.exec(['add', 'test.js'])
  await rig.remove('test.js')

  const readme = await rig.read('README.md')

  await rig.remove('README.md')
  await rig.git.exec(['add', 'README.md'])
  await rig.write('README_NEW.md', readme)
  await rig.git.exec(['add', 'README_NEW.md'])
  await rig.remove('README_NEW.md')

  assert.match(
    await rig.git.exec(['status', '--porcelain']),
    'RD README.md -> README_NEW.md\nAD test.js\n?? .nano-staged.json'
  )

  await rig.commit()

  assert.match(
    await rig.git.exec(['status', '--porcelain']),
    ' D README_NEW.md\n D test.js\n?? .nano-staged.json'
  )

  assert.is(fs.existsSync(path.join(rig.temp, 'test.js')), false)
  assert.is(fs.existsSync(path.join(rig.temp, 'README_NEW.md')), false)
})

test('does not resurrect removed files due to git bug when tasks fail', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.remove('README.md')
  await rig.write('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  assert.match(
    await rig.git.exec(['status', '--porcelain']),
    ' D README.md\nA  test.js\n?? .nano-staged.json'
  )

  await rig.commit({ nano_staged: ['--allow-empty'] }).catch((error) => {
    assert.match(error, 'Restoring to original state because of errors...')
  })

  assert.match(
    await rig.git.exec(['status', '--porcelain']),
    ' D README.md\nA  test.js\n?? .nano-staged.json'
  )
  assert.is(fs.existsSync(path.join(rig.temp, 'README_NEW.md')), false)
})

test.run()
