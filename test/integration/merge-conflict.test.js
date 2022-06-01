import * as assert from 'uvu/assert'
import { suite } from 'uvu'

import { prettier_write, prettier_list_diff } from './fixtures/configs.js'
import { pretty_js, ugly_js } from './fixtures/files.js'
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

test('handles merge conflicts', async ({ rig }) => {
  const file_in_branchA = `module.exports = "foo";\n`
  const file_in_branchB = `module.exports = 'bar'\n`
  const file_in_branchB_fixed = `module.exports = "bar";\n`
  const merge_conflict =
    '<<<<<<< HEAD\n' +
    'module.exports = "foo";\n' +
    '=======\n' +
    'module.exports = "bar";\n' +
    '>>>>>>> branch-b\n'

  {
    await rig.git.exec(['checkout', '-b', 'branch-a'])
    await rig.append('test.js', file_in_branchA)
    await rig.append('.nano-staged.json', JSON.stringify(prettier_write))
    await rig.git.exec(['add', '.'])
    await rig.commit({ git_commit: ['-m commit a'] })

    assert.is(await rig.read('test.js'), file_in_branchA)
  }

  await rig.git.exec(['checkout', 'master'])

  {
    await rig.git.exec(['checkout', '-b', 'branch-b'])
    await rig.append('test.js', file_in_branchB)
    await rig.append('.nano-staged.json', JSON.stringify(prettier_write))
    await rig.git.exec(['add', '.'])
    await rig.commit({ git_commit: ['-m commit b'] })

    assert.is(await rig.read('test.js'), file_in_branchB_fixed)
  }

  await rig.git.exec(['checkout', 'master'])
  await rig.git.exec(['merge', 'branch-a'])

  assert.is(await rig.read('test.js'), file_in_branchA)
  assert.match(await rig.git.exec(['log', '-1', '--pretty=%B']), 'commit a')

  await rig.git.exec(['merge', 'branch-b']).catch((error) => {
    assert.match(error, 'Merge conflict in test.js')
  })

  assert.match(await rig.read('test.js'), merge_conflict)

  await rig.write('test.js', file_in_branchB)

  assert.is(await rig.read('test.js'), file_in_branchB)

  await rig.git.exec(['add', '.'])
  await rig.commit({ git_commit: ['--no-edit'] })

  assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '4')

  const log = await rig.git.exec(['log', '-1', '--pretty=%B'])

  assert.match(log, `Merge branch 'branch-b`)
  assert.match(log, `Conflicts:`)
  assert.match(log, `test.js`)
  assert.is(await rig.read('test.js'), file_in_branchB_fixed)
})

test('handles merge conflict when task errors', async ({ rig }) => {
  const file_in_branchA = `module.exports = "foo";\n`
  const file_in_branchB = `module.exports = 'bar'\n`
  const file_in_branchB_fixed = `module.exports = "bar";\n`
  const merge_conflict =
    '<<<<<<< HEAD\n' +
    'module.exports = "foo";\n' +
    '=======\n' +
    'module.exports = "bar";\n' +
    '>>>>>>> branch-b\n'

  {
    await rig.git.exec(['checkout', '-b', 'branch-a'])
    await rig.append('test.js', file_in_branchA)
    await rig.append('.nano-staged.json', JSON.stringify(prettier_write))
    await rig.git.exec(['add', '.'])
    await rig.commit({ git_commit: ['-m commit a'] })

    assert.is(await rig.read('test.js'), file_in_branchA)
  }

  await rig.git.exec(['checkout', 'master'])

  {
    await rig.git.exec(['checkout', '-b', 'branch-b'])
    await rig.append('test.js', file_in_branchB)
    await rig.append('.nano-staged.json', JSON.stringify(prettier_write))
    await rig.git.exec(['add', '.'])
    await rig.commit({ git_commit: ['-m commit b'] })

    assert.is(await rig.read('test.js'), file_in_branchB_fixed)
  }

  await rig.git.exec(['checkout', 'master'])
  await rig.git.exec(['merge', 'branch-a'])

  assert.is(await rig.read('test.js'), file_in_branchA)
  assert.match(await rig.git.exec(['log', '-1', '--pretty=%B']), 'commit a')

  await rig.git.exec(['merge', 'branch-b']).catch((error) => {
    assert.match(error, 'Merge conflict in test.js')
  })

  assert.match(await rig.read('test.js'), merge_conflict)

  await rig.write('test.js', file_in_branchB)

  assert.is(await rig.read('test.js'), file_in_branchB)

  await rig.git.exec(['add', '.'])
  await rig.write('.nano-staged.json', JSON.stringify(prettier_list_diff))
  await rig.commit().catch(async (error) => {
    assert.match(error, 'Restoring to original state because of errors')
    assert.is((await rig.git.exec(['rev-list', '--count', 'HEAD'])).trim(), '2')
    assert.match(await rig.git.exec(['status']), 'All conflicts fixed but you are still merging')
    assert.is(await rig.read('test.js'), file_in_branchB)
  })
})

test.run()
