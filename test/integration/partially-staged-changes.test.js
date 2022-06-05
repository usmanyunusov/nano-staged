import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { prettier_write, prettier_list_diff } from './fixtures/configs.js'
import { invalid_js, pretty_js, ugly_js } from './fixtures/files.js'
import { NanoStagedTestRig } from './utils/test-rig.js'

const test = suite('integration')

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

test('commits partial change from partially staged file when no errors from linter', async ({
  rig,
}) => {
  const appended = `\nconsole.log("test");\n`

  await rig.append('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('test.js', pretty_js)
  await rig.git.exec(['add', 'test.js'])
  await rig.append('test.js', appended)

  const result = await rig.commit()

  assert.match(result, 'Backing up unstaged changes for staged files')
  assert.match(result, 'Applying modifications from tasks')
  assert.match(result, 'Restoring unstaged changes for staged files')

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is((await rig.git.exec(['show', 'HEAD:test.js'])).trim(), pretty_js.trim())

  const status = await rig.git.exec(['status'])

  assert.match(status, 'modified:   test.js')
  assert.match(status, 'no changes added to commit')
  assert.is(await rig.read('test.js'), pretty_js + appended)
})

test('commits partial change from partially staged file when no errors from linter and linter modifies file', async ({
  rig,
}) => {
  const appended = '\n\nconsole.log("test");\n'

  await rig.append('.nano-staged.json', JSON.stringify(prettier_write))
  await rig.append('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])
  await rig.append('test.js', appended)

  await rig.commit()

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'test')
  assert.is((await rig.git.exec(['show', 'HEAD:test.js'])).trim(), pretty_js.trim())

  const status = await rig.git.exec(['status'])

  assert.match(status, 'modified:   test.js')
  assert.match(status, 'no changes added to commit')
  assert.is(await rig.read('test.js'), pretty_js + appended)
})

test('fails to commit partial change from partially staged file when errors from linter', async ({
  rig,
}) => {
  const appended = '\nconsole.log("test");\n'

  await rig.append('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])
  await rig.append('test.js', appended)

  const status = await rig.git.exec(['status'])

  await rig.commit().catch((error) => {
    assert.match(error, 'Restoring to original state because of errors')
  })

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')
  assert.is(await rig.git.exec(['status']), status)
  assert.is(await rig.read('test.js'), ugly_js + appended)
})

test('fails to commit partial change from partially staged file when errors from linter and linter modifies files', async ({
  rig,
}) => {
  const appended = '\nconsole.log("test");\n'

  await rig.append('.nano-staged.json', JSON.stringify(prettier_write))
  await rig.append('test.js', invalid_js)
  await rig.git.exec(['add', 'test.js'])
  await rig.append('test.js', appended)

  const status = await rig.git.exec(['status'])

  await rig.commit().catch((error) => {
    assert.match(error, 'Restoring to original state because of errors')
  })

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')
  assert.is(await rig.git.exec(['status']), status)
  assert.is(await rig.read('test.js'), invalid_js + appended)
})

test.run()
