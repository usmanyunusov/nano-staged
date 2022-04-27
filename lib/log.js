import c from './colors.js'

function fail(line) {
  console.error(c.red('× ' + line))
}

function warn(line) {
  console.warn(c.cyan('- ' + line))
}

export function log(entry) {
  switch (entry.type) {
    default: {
      throw new Error(`Unknown event type: ${type}`)
    }
    case 'failure': {
      const reason = entry.reason
      switch (reason) {
        default: {
          throw new Error(`Unknown failure type: ${reason}`)
        }
        case 'no-config': {
          fail('Create Nano Staged config.')
          break
        }
        case 'no-path-config': {
          fail(`Nano Staged config file ${c.yellow(entry.path)} is not found.`)
          break
        }
        case 'invalid-config': {
          fail(`Nano Staged ${c.yellow(entry.path)} config invalid.`)
          break
        }
        case 'no-git-repo': {
          fail('Nano Staged didn’t find git directory.')
          break
        }
        case 'merge-conflict': {
          fail('Merge conflict! Unstaged changes have not been restored.')
          break
        }
        case 'empty-git-commit': {
          fail('Prevented an empty git commit!')
          break
        }
      }
      break
    }

    case 'output': {
      const stream = entry.stream
      switch (stream) {
        default: {
          throw new Error(`Unknown output stream: ${stream}`)
        }
        case 'stderr': {
          process.stderr.write(entry.data)
          break
        }
      }
      break
    }

    case 'info': {
      const detail = entry.detail
      switch (detail) {
        default: {
          throw new Error(`Unknown info event detail: ${detail}`)
        }
        case 'no-files': {
          warn(`No ${entry.runner_type} files found.`)
          break
        }
        case 'no-matching-files': {
          warn('No files match any configured task.')
          break
        }
      }
    }
  }
}
