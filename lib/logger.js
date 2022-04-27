import c from './colors.js'

function fail(line) {
  console.error(c.red('× ' + line))
}

function warn(line) {
  console.log(c.cyan('- ' + line))
}

export function create_logger(std = process.stderr) {
  const logger = {
    log(event) {
      const type = event.type
      switch (type) {
        default: {
          throw new Error(`Unknown event type: ${type}`)
        }
        case 'failure': {
          const reason = event.reason
          switch (reason) {
            default: {
              throw new Error(`Unknown failure reason: ${reason}`)
            }
            case 'no-config': {
              fail('Create Nano Staged config.')
              break
            }
            case 'no-file-config': {
              fail(`Nano Staged config file ${c.yellow(event.file)} is not found.`)
              break
            }
            case 'invalid-config': {
              fail('Nano Staged config invalid.')
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
          const stream = event.stream
          switch (stream) {
            default: {
              throw new Error(`Unknown output stream: ${stream}`)
            }
            case 'stderr': {
              std.write(event.data)
              break
            }
          }
          break
        }
        case 'info': {
          const detail = event.detail
          switch (detail) {
            default: {
              throw new Error(`Unknown info event detail: ${detail}`)
            }
            case 'no-files': {
              warn(`No ${event.runner_type} files found.`)
              break
            }
            case 'no-matching-files': {
              warn('No files match any configured task.')
              break
            }
          }
        }
      }
    },
  }

  return logger
}
