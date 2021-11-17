import { promises as fs } from 'fs'
import { resolve } from 'path'

import { findUp } from '../utils/index.js'

const NODE_PACKAGE_JSON = 'package.json'
const CONFIG_NAME = 'nano-staged'

export async function loadConfig(cwd = process.cwd()) {
  let rootPath = findUp(NODE_PACKAGE_JSON, cwd)

  if (!rootPath) {
    return undefined
  }

  let pkgPath = resolve(rootPath, NODE_PACKAGE_JSON)
  let pkgJson = JSON.parse(await fs.readFile(pkgPath, 'utf8'))
  let config = pkgJson[CONFIG_NAME]

  return config
}

export function validConfig(config) {
  return !!(
    config &&
    Object.keys(config).length &&
    Object.keys(config).every(
      (key) =>
        key &&
        typeof key === 'string' &&
        config[key] &&
        (typeof config[key] === 'string' ||
          (Array.isArray(config[key]) &&
            config[key].every((cmd) => cmd && typeof cmd === 'string')))
    )
  )
}
