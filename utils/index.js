import { spawn as baseSpawn } from 'child_process'
import { join, delimiter } from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import pico from 'picocolors'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function toArray(val) {
  return Array.isArray(val) ? val : [val]
}

export function showVersion(print) {
  let pkg = readFileSync(join(fileURLToPath(import.meta.url), '../..', 'package.json'))
  let pkgJson = JSON.parse(pkg.toString())
  print(`Nano Staged ${pico.bold(`v${pkgJson.version}`)}`)
}

export async function spawn(program, args, options = {}) {
  let opts = {
    preferLocal: false,
    ...options,
  }

  opts.env = {
    ...process.env,
    ...options.env,
  }

  if (opts.preferLocal) {
    opts.env[process.env.PATH ? 'PATH' : 'path'] =
      opts.env.PATH + delimiter + join(fileURLToPath(import.meta.url), '../../../.bin')
  }

  /* c8 ignore next 4 */
  if (process.platform === 'win32') {
    args = ['/c', cmd].concat(args)
    program = process.env.comspec
  }

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
