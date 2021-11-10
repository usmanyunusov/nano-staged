import { resolve, join, normalize, relative, isAbsolute } from 'path'
import { spawn as _spawn } from 'child_process'
import { existsSync } from 'fs'

export function toAbsolute(file, cwd) {
  return isAbsolute(file) ? file : normalize(resolve(cwd, file))
}

export function toRelative(file, cwd) {
  return normalize(relative(cwd, file))
}

export async function git(args, opts) {
  try {
    return await spawn('git', args, opts)
  } catch (err) {
    throw err
  }
}

export function findUp(dir, name) {
  while (!existsSync(join(dir, name))) {
    let parentDir = resolve(dir, '..')

    if (parentDir === dir) {
      return undefined
    }

    dir = parentDir
  }

  return dir
}

export async function getVersion() {
  return '0.1.0'
}

export async function spawn(program, args, opts = {}, onData) {
  return new Promise((resolve, reject) => {
    let proc = _spawn(program, args, opts)
    let processingDone = false
    let err = null
    let stdout = ''

    proc.on('error', (err) => {
      reject(err)
    })

    function updateStdout(chunk) {
      stdout += chunk
      if (onData) {
        onData(chunk)
      }
    }

    function finish() {
      if (err) {
        reject(err)
      } else {
        resolve(stdout)
      }
    }

    if (proc.stderr) {
      proc.stderr.on('data', updateStdout)
    }

    if (proc.stdout) {
      proc.stdout.on('data', updateStdout)
    }

    processingDone = true

    proc.on('close', (code, signal) => {
      if (signal || code >= 1) {
        err = new Error(
          [
            'Command failed.',
            signal ? `Exit signal: ${signal}` : `Exit code: ${code}`,
            `Command: ${program}`,
            `Arguments: ${args.join(' ')}`,
            `Directory: ${opts?.cwd || process.cwd()}`,
            `Output:\n${stdout.trim()}`,
          ].join('\n')
        )
        err.EXIT_SIGNAL = signal
        err.EXIT_CODE = code
      }

      if (processingDone || err) {
        finish()
      }
    })
  })
}

function firstString(...args) {
  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string') {
      return args[i]
    }
  }
}

export function stringToArgv(str) {
  let REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi
  let args = []
  let match

  do {
    match = REG_STR.exec(str)
    if (match !== null) {
      args.push(firstString(match[1], match[6], match[0]))
    }
  } while (match !== null)

  return args
}

export function normalizePath(path, stripTrailing) {
  if (path === '\\' || path === '/') return '/'

  let len = path.length
  if (len <= 1) return path

  let prefix = ''
  if (len > 4 && path[3] === '\\') {
    let ch = path[2]

    if ((ch === '?' || ch === '.') && path.slice(0, 2) === '\\\\') {
      path = path.slice(2)
      prefix = '//'
    }
  }

  let segs = path.split(/[/\\]+/)
  if (stripTrailing !== false && segs[segs.length - 1] === '') {
    segs.pop()
  }

  return prefix + segs.join('/')
}
