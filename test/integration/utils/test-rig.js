import { fileURLToPath } from 'url'
import { platform } from 'os'
import path from 'path'

import { FileSystemTestRig } from './file-system-test-rig.js'
import { executor } from '../../../lib/executor.js'
import { create_git } from '../../../lib/git.js'

const is_windows = platform() === 'win32'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const nano_staged_bin = path.resolve(__dirname, '../../../lib/bin.js')

export class NanoStagedTestRig extends FileSystemTestRig {
  initial_commit = true
  no_commit = false
  git = create_git(this.temp)

  constructor(props) {
    super(props)
    this.with_git = false
  }

  async git_init() {
    await this.git.exec(['init'])

    if (is_windows) {
      await this.git.exec(['config', 'core.autocrlf', 'input'])
    }

    await this.git.exec(['config', 'user.name', '"nano-staged"'])
    await this.git.exec(['config', 'user.email', '"test@nanostaged.com"'])
    await this.git.exec(['config', 'merge.conflictstyle', 'merge'])

    if (this.initial_commit) {
      await this.append('README.md', '# Test\n')
      await this.git.exec(['add', 'README.md'])
      await this.git.exec(['commit', '-m initial commit'])
    }

    this.with_git = true
  }

  async cleanup() {
    await this.remove(this.temp)
  }

  async commit(options, cwd = this.temp) {
    const nano_staged_args = Array.isArray(options?.nano_staged) ? options.nano_staged : []
    const git_commit_args = Array.isArray(options?.git_commit) ? options.git_commit : ['-m test']

    try {
      const result = await executor(nano_staged_bin, nano_staged_args, { cwd, env: { CI: 1 } })

      if (this.with_git && !this.no_commit) {
        await this.git.exec(['commit', ...git_commit_args], { cwd })
      }

      return result
    } catch (error) {
      throw error
    }
  }
}
