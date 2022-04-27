import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { prettier_list_diff } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'
import { pretty_js } from './fixtures/files.js'

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

test('works when amending previous commit with unstaged changes', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('README.md', '\n## Amended\n')
  await rig.git.exec(['add', 'README.md'])
  await rig.append('README.md', '\n## Edited\n')
  await rig.append('test-untracked.js', pretty_js)
  await rig.commit({ git_commit: ['--amend', '--no-edit'] })

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '1')
  assert.is((await rig.git.exec(['log', '-1', '--pretty=%B'])).trim(), 'initial commit')

  assert.is(await rig.read('README.md'), '# Test\n\n## Amended\n\n## Edited\n')
  assert.is(await rig.read('test-untracked.js'), pretty_js)

  const status = await rig.git.exec(['status'])
  assert.match(status, 'modified:   README.md')
  assert.match(status, 'test-untracked.js')
  assert.match(status, 'no changes added to commit')
})

test.run()
