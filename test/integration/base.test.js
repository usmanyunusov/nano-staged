import * as assert from 'uvu/assert'
import { suite } from 'uvu'
import path from 'path'

import { prettier_write, prettier_list_diff } from './fixtures/configs.js'
import { pretty_js, ugly_js, invalid_js } from './fixtures/files.js'
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
    await ctx.rig.cleanup()
  } catch (e) {
    console.error('uvu after error', e)
    process.exit(1)
  }
})

test('commits entire staged file when no errors from linter', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))

  await rig.write('test file.js', pretty_js)
  await rig.git.exec(['add', 'test file.js'])

  await rig.commit()

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is(await rig.read('test file.js'), pretty_js)
})

test('commits entire staged file when no errors and linter modifies file', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_write))

  await rig.write('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.write('test2.js', ugly_js)
  await rig.git.exec(['add', 'test2.js'])

  await rig.commit()

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is(await rig.read('test.js'), pretty_js)
  assert.is(await rig.read('test2.js'), pretty_js)
})

test('fails to commit entire staged file when errors from linter', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))

  await rig.write('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  const status = await rig.git.exec(['status'])

  await rig.commit().catch(async (error) => {
    assert.match(error, 'Restoring to original state because of errors')
    assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
    assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')
    assert.is(await rig.git.exec(['status']), status)
    assert.is(await rig.read('test.js'), ugly_js)
  })
})

test('fails to commit entire staged file when errors from linter and linter modifies files', async ({
  rig,
  ...ctx
}) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_write))

  await rig.write('test.js', invalid_js)
  await rig.git.exec(['add', 'test.js'])

  const status = await rig.git.exec(['status'])

  await rig.commit().catch(async (error) => {
    assert.match(error, 'Restoring to original state because of errors')
    assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
    assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')
    assert.is(await rig.git.exec(['status']), status)
    assert.is(await rig.read('test.js'), invalid_js)
  })
})

test('clears unstaged changes when linter applies same changes', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_write))

  await rig.append('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.remove(path.join(rig.temp, 'test.js'))
  await rig.append('test.js', pretty_js)

  await rig.commit()

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is((await rig.git.exec(['show', 'HEAD:test.js'])).trim(), pretty_js.trim())
  assert.match((await rig.git.exec(['status'])).trim(), 'nothing added to commit')
  assert.is(await rig.read('test.js'), pretty_js)
})

test('clears unstaged changes when linter applies same changes', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_write))

  await rig.append('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.remove(path.join(rig.temp, 'test.js'))
  await rig.append('test.js', pretty_js)

  await rig.commit()

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is((await rig.git.exec(['show', 'HEAD:test.js'])).trim(), pretty_js.trim())
  assert.match((await rig.git.exec(['status'])).trim(), 'nothing added to commit')
  assert.is(await rig.read('test.js'), pretty_js)
})

test.run()
