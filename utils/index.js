import { resolve, join, normalize, relative, isAbsolute, parse, dirname } from 'path'
import { spawn as _spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import pico from 'picocolors'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function toArray(val) {
  return Array.isArray(val) ? val : [val]
}

export function toAbsolute(file, cwd) {
  return isAbsolute(file) ? file : normalize(resolve(cwd, file))
}

export function toRelative(file, cwd) {
  return normalize(relative(cwd, file))
}

export function findUp(name, cwd = '') {
  let directory = resolve(cwd)
  let { root } = parse(directory)

  while (true) {
    let foundPath = resolve(directory, name)

    if (existsSync(foundPath)) return directory
    if (directory === root) return undefined

    directory = dirname(directory)
  }
}

export function showVersion(print) {
  let pkg = readFileSync(join(fileURLToPath(import.meta.url), '../..', 'package.json'))
  let pkgJson = JSON.parse(pkg.toString())
  print(`Nano Staged ${pico.bold(`v${pkgJson.version}`)}`)
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

export function stringToArgv(str = '') {
  let args = []
  let match

  while (true) {
    match = REG_STR.exec(str)

    if (!match) {
      return args
    }

    for (let arg of [match[1], match[6], match[0]]) {
      if (typeof arg === 'string') {
        args.push(arg)
      }
    }
  }
}
