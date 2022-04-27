import { join, resolve } from 'path'
import { is } from 'uvu/assert'
import esmock from 'esmock'
import { test } from 'uvu'
import fs from 'fs-extra'

import { writeFile, makeDir, appendFile, fixture, removeFile } from './utils/index.js'
import { createGitWorkflow } from '../lib/git-workflow.js'
import { createGit } from '../lib/git.js'

let cwd = fixture('simple/git-workflow-test')

async function execGit(args) {
  let git = createGit(cwd)
  return await git.exec(args, { cwd })
}

test.before.each(async () => {
  await makeDir(cwd)
  await execGit(['init'])
  await execGit(['config', 'user.name', '"test"'])
  await execGit(['config', 'user.email', '"test@test.com"'])
  await appendFile('README.md', '# Test\n', cwd)
  await execGit(['add', 'README.md'])
  await execGit(['commit', '-m initial commit'])
})

test.after.each(async () => {
  await removeFile(cwd)
})

test('should patch file for original state', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })
  await gitWorkflow.backupOriginalState()

  is(fs.existsSync(resolve(cwd, './.git/nano-staged.patch')), true)
})

test('should backup original state handle errors', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.test'),
    allowEmpty: false,
    rootPath: cwd,
  })

  try {
    await gitWorkflow.backupOriginalState()
  } catch (error) {
    is(!!error, true)
  }
})

test('should patch file for unstaged files', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  await writeFile('README.md', '# Test\n# Test', cwd)
  await gitWorkflow.backupUnstagedFiles([join(cwd, 'README.md')])

  is(fs.existsSync(resolve(cwd, './.git/nano-staged_partial.patch')), true)
})

test('should backup unstaged files handle errors', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  try {
    await gitWorkflow.backupUnstagedFiles([`random_file-${Date.now().toString()}`])
  } catch (error) {
    is(!!error, true)
  }
})

test('should apply changes files', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  await writeFile('README.md', '# Test\n# Test', cwd)
  await gitWorkflow.applyModifications([join(cwd, 'README.md')])

  is(await execGit(['diff', '--name-only', '--staged']), 'README.md\n')
})

test('should apply empty files', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  try {
    await gitWorkflow.applyModifications([join(cwd, 'README.md')])
  } catch (error) {
    is(error, 'Prevented an empty git commit!')
  }
})

test('should apply changes files handle errors', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  try {
    await writeFile('README.md', '# Test\n# Test', cwd)
    await gitWorkflow.applyModifications([join(cwd, 'error.md')])
  } catch (error) {
    is(!!error, true)
  }
})

test('should restore unstaged files handle errors', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  try {
    await gitWorkflow.restoreUnstagedFiles([`random_file-${Date.now().toString()}`])
  } catch (error) {
    is(error, 'Merge conflict!!! Unstaged changes not restored.')
  }
})

test('should restore unstaged files', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  await writeFile('README.md', '# Test\n# Test', cwd)
  await gitWorkflow.backupOriginalState()
  await gitWorkflow.restoreOriginalState()

  is(await execGit(['diff', '--name-only', 'HEAD']), 'README.md\n')
})

test('should restore unstaged files handle error', async () => {
  const { createGitWorkflow } = await esmock('../lib/git-workflow.js', {
    '../lib/git.js': {
      createGit: () => ({
        checkout: async () => Promise.reject('Checkout error'),
      }),
    },
  })

  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  await gitWorkflow.restoreOriginalState().catch((error) => {
    is(error, 'Checkout error')
  })
})

test('should remove original and unstaged patch', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  await writeFile('README.md', '# Test\n# Test', cwd)
  await gitWorkflow.backupOriginalState()
  await gitWorkflow.backupUnstagedFiles([[join(cwd, 'README.md')]])
  await gitWorkflow.cleanUp()

  is(fs.existsSync(resolve(cwd, './.git/nano-staged_partial.patch')), false)
  is(fs.existsSync(resolve(cwd, './.git/nano-staged.patch')), false)
})

test('should clean up handle errors', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  gitWorkflow.hasPatch = () => {
    throw new Error('Clean up error')
  }

  try {
    await gitWorkflow.cleanUp()
  } catch (error) {
    is(error.message, 'Clean up error')
  }
})

test('hasPatch return false when no patch file', async () => {
  let gitWorkflow = createGitWorkflow({
    dotPath: resolve(cwd, './.git'),
    allowEmpty: false,
    rootPath: cwd,
  })

  is(gitWorkflow.hasPatch('./test.patch'), false)
})

test.run()
