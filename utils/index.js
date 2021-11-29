import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import pico from 'picocolors'
import { join } from 'path'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function toArray(val) {
  return Array.isArray(val) ? val : [val]
}

export function showVersion(print) {
  let pkg = readFileSync(join(fileURLToPath(import.meta.url), '../..', 'package.json'))
  let pkgJson = JSON.parse(pkg.toString())
  print(`Nano Staged ${pico.bold(`v${pkgJson.version}`)}`)
}

export function argvStrToArr(str = '') {
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
