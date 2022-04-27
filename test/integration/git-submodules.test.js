import * as assert from 'uvu/assert'
import { suite } from 'uvu'
import path from 'path'

import { prettier_list_diff } from './fixtures/configs.js'
import { NanoStagedTestRig } from './utils/test-rig.js'
import { pretty_js } from './fixtures/files.js'

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

test('handles git submodules', async ({ rig }) => {
  try {
    let submodule_dir = path.resolve(rig.temp, 'submodule-temp')

    await rig.append('.nano-staged.json', JSON.stringify(prettier_list_diff))
    await rig.ensure(submodule_dir)
    await rig.git.exec(['init'], { cwd: submodule_dir })
    await rig.git.exec(['config', 'user.name', '"test"'], { cwd: submodule_dir })
    await rig.git.exec(['config', 'user.email', '"test@test.com"'], { cwd: submodule_dir })
    await rig.append('README.md', '# Test\n', submodule_dir)
    await rig.git.exec(['add', 'README.md'], { cwd: submodule_dir })
    await rig.git.exec(['commit', '-m initial commit'], { cwd: submodule_dir })

    await rig.git.exec(['submodule', 'add', '--force', './submodule-temp', './submodule'])
    submodule_dir = path.resolve(rig.temp, 'submodule')

    await rig.git.exec(['config', 'user.name', '"test"'], { cwd: submodule_dir })
    await rig.git.exec(['config', 'user.email', '"test@test.com"'], { cwd: submodule_dir })

    await rig.append('test.js', pretty_js, submodule_dir)
    await rig.git.exec(['add', 'test.js'], { cwd: submodule_dir })

    await rig.commit(undefined, submodule_dir)

    const commit_count = await rig.git.exec(['rev-list', '--count', 'HEAD'], { cwd: submodule_dir })
    const last_commit = await rig.git.exec(['log', '-1', '--pretty=%B'], { cwd: submodule_dir })
    const file = await rig.read('test.js', submodule_dir)

    assert.is(commit_count.trim(), '2')
    assert.is(last_commit.trim(), 'test')
    assert.is(file, pretty_js)
  } catch (error) {
    console.log(error)
  }
})

test.run()
