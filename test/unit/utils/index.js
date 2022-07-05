import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'

const DIRNAME = dirname(fileURLToPath(import.meta.url))

export async function appendFile(filename, content, dir = process.cwd()) {
  await fs.appendFile(resolve(dir, filename), content)
}

export async function makeDir(dir = process.cwd()) {
  await fs.mkdir(dir)
}

export async function writeFile(filename, content, dir = process.cwd()) {
  await fs.writeFile(resolve(dir, filename), content)
}

export async function removeFile(dir) {
  if (dir) {
    await fs.remove(dir)
  }
}

export function fixture(name) {
  return resolve(DIRNAME, '../fixtures', name)
}

export function createStdout() {
  let result = {
    out: '',
    write: (symbols) => {
      result.out += symbols
    },
  }

  return result
}
