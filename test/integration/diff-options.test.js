import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { prettier_list_diff } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'
import { ugly_js } from './fixtures/files.js'

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

test('supports overriding file list using --diff', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])
  await rig.git.exec(['commit', '-m', 'ugly'], { cwd: rig.temp })

  const hashes = (await rig.git.exec(['log', '--format=format:%H'])).trim().split('\n')

  rig.no_commit = true

  await rig
    .commit({
      nano_staged: ['--diff', `${hashes[1]}...${hashes[0]}`],
    })
    .catch((error) => {
      assert.match(error, 'prettier --list-different')
      assert.match(error, 'test.js')
    })

  assert.is(hashes.length, 2)
})

test('supports overriding default --diff-filter', async ({ rig }) => {
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.append('test.js', ugly_js)
  await rig.git.exec(['add', 'test.js'])

  rig.no_commit = true

  await rig
    .commit({
      nano_staged: ['--diff-filter', 'D'],
    })
    .then((result) => {
      assert.match(result, 'No staged files found.')
    })
})

test.run()
