import * as assert from 'uvu/assert'
import { suite } from 'uvu'
import path from 'path'

import { prettier_list_diff } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'
import { pretty_js } from './fixtures/files.js'

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

test('handles git submodules', async ({ rig }) => {
  let work_tree_dir = path.resolve(rig.temp, 'worktree-temp')

  await rig.append('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.ensure(work_tree_dir)

  await rig.git.exec(['branch', 'test'])
  await rig.git.exec(['worktree', 'add', work_tree_dir, 'test'])

  await rig.append('test.js', pretty_js, work_tree_dir)
  await rig.git.exec(['add', 'test.js'], { cwd: work_tree_dir })

  await rig.commit(undefined, work_tree_dir)

  const commit_count = await rig.git.exec(['rev-list', '--count', 'HEAD'], { cwd: work_tree_dir })
  const last_commit = await rig.git.exec(['log', '-1', '--pretty=%B'], { cwd: work_tree_dir })
  const file = await rig.read('test.js', work_tree_dir)

  assert.is(commit_count.trim(), '2')
  assert.is(last_commit.trim(), 'test')
  assert.is(file, pretty_js)
})

test.run()
