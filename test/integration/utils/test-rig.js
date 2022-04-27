import { fileURLToPath } from 'url'
import { platform } from 'os'
import path from 'path'

import { FilesystemTestRig } from './filesystem-test-rig.js'
import { executor } from '../../../lib/executor.js'
import { create_git } from '../../../lib/git.js'

const is_windows = platform() === 'win32'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const nano_staged_bin = path.resolve(__dirname, '../../../lib/bin.js')

export class NanoStagedTestRig extends FilesystemTestRig {
  with_git = true
  git = create_git(this.temp)

  async setup() {
    if (this.with_git) {
      await this.git.exec(['init'])
      if (is_windows) {
        await this.git.exec(['config', 'core.autocrlf', 'input'])
      }
      await this.git.exec(['config', 'user.name', '"nano-staged"'])
      await this.git.exec(['config', 'user.email', '"test@nanostaged.com"'])
      await this.git.exec(['config', 'merge.conflictstyle', 'merge'])
      await this.append('README.md', '# Test\n')
      await this.append('.gitignore', '/node_modules')
      await this.git.exec(['add', 'README.md'])
      await this.git.exec(['add', '.gitignore'])
      await this.write(
        'package.json',
        JSON.stringify({
          name: 'nano-staged-test',
          type: 'module',
          prettier: {
            semi: true,
            singleQuote: false,
          },
        })
      )

      await this.git.exec(['add', 'package.json'])
      await this.git.exec(['commit', '-m', 'initial commit'])
    }
  }

  async commit(options, cwd = this.temp) {
    const nano_staged_args = Array.isArray(options?.nano_staged) ? options.nano_staged : []
    const git_commit_args = Array.isArray(options?.git_commit) ? options.git_commit : ['-m', 'test']

    try {
      await executor(nano_staged_bin, nano_staged_args, { cwd })

      if (this.with_git) {
        await this.git.exec(['commit', ...git_commit_args], { cwd, ...options })
      }
    } catch (error) {
      throw error
    }
  }
}
