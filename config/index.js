import { findUp } from '../utils/index.js'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

const NODE_PACKAGE_JSON = 'package.json'
const CONFIG_NAME = 'nano-staged'

export async function loadConfig(cwd = '') {
  let pkgDir = findUp(cwd, NODE_PACKAGE_JSON)

  if (!pkgDir) {
    return undefined
  }

  let pkgPath = resolve(pkgDir, NODE_PACKAGE_JSON)
  let pkgJson = JSON.parse(await readFile(pkgPath, 'utf8'))
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
        (typeof config[key] === 'string' || Array.isArray(config[key]))
    )
  )
}
