import { spawn as baseSpawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolve, join } from 'path'
import pico from 'picocolors'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function toArray(val) {
  return Array.isArray(val) ? val : [val]
}

export function findUp(name, cwd = process.cwd()) {
  let dir = resolve(cwd)

  do {
    cwd = dir
    const foundPath = resolve(cwd, name)
    if (existsSync(foundPath)) return cwd
    dir = resolve(cwd, '../')
  } while (dir !== cwd)
}

export function showVersion(print) {
  let pkg = readFileSync(join(fileURLToPath(import.meta.url), '../..', 'package.json'))
  let pkgJson = JSON.parse(pkg.toString())
  print(`Nano Staged ${pico.bold(`v${pkgJson.version}`)}`)
}

export async function spawn(program, args, opts = {}) {
  let child = baseSpawn(program, args, opts)
  let output = ''

  if (child.stdout) {
    child.stdout.on('data', (data) => {
      output += data
    })
  }

  if (child.stderr) {
    child.stderr.on('data', (data) => {
      output += data
    })
  }

  let promise = new Promise((resolve, reject) => {
    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(output)
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
