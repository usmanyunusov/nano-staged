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

test('fails when without `--allow-empty`, to prevent an empty git commit', async ({ rig }) => {
  try {
    await rig.write('.nano-staged.json', JSON.stringify(prettier_write))
    await rig.write('test.js', pretty_js)

    await rig.git.exec(['add', '.'])
    await rig.git.exec(['commit', '-m', 'committed pretty file'])

    await rig.write('test.js', ugly_js)
    await rig.git.exec(['add', 'test.js'])

    await rig.commit()
  } catch (error) {
    assert.match(error, 'Prevented an empty git commit!')
    assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
    assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'committed pretty file')
    assert.is(await rig.read('test.js'), pretty_js)
  }
})

test('with `--allow-empty` creates empty commit', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_write))
  await rig.write('test.js', pretty_js)

  await rig.git.exec(['add', '.'])
  await rig.git.exec(['commit', '-m', 'committed pretty file'])

  await rig.write('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  await rig.commit({
    nano_staged: ['--allow-empty'],
    git_commit: ['-m', 'test', '--allow-empty'],
  })

  const commit_count = await rig.git.exec(['rev-list', '--count', 'HEAD'])
  const last_commit = await rig.git.exec(['log', '-1', '--pretty=%B'])
  const file = await rig.read('test.js')

  assert.is(commit_count.trim(), '3')
  assert.is(last_commit.trim(), 'test')
  assert.is(file, pretty_js)
})

test.run()
