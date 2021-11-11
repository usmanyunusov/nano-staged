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

export async function spawn(program, args, opts = {}) {
  let child = _spawn(program, args, opts)
  let stdout = ''
  let stderr = ''

  if (child.stdout) {
    child.stdout.on('data', (data) => {
      stdout += data
    })
  }

  if (child.stderr) {
    child.stderr.on('data', (data) => {
      stderr += data
    })
  }

  let promise = new Promise((resolve, reject) => {
    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(stderr)
      }
    })
  })

  promise.child = child

  return promise
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
