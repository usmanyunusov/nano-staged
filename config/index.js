import syncFs, { promises as fs } from 'fs'
import { resolve } from 'path'

const NODE_PACKAGE_JSON = 'package.json'
const CONFIG_NAME = 'nano-staged'
const PLACES = [`.${CONFIG_NAME}.json`, `${CONFIG_NAME}.json`, NODE_PACKAGE_JSON]

export async function loadConfig(cwd = process.cwd()) {
  try {
    let config
    let dir = resolve(cwd)

    do {
      cwd = dir

      for (let place of PLACES) {
        let path = resolve(cwd, place)

        if (!config && syncFs.existsSync(path)) {
          if (place === 'package.json') {
            let pkg = JSON.parse(await fs.readFile(path, 'utf8'))
            config = pkg[CONFIG_NAME]
          } else {
            config = JSON.parse(await fs.readFile(path, 'utf8'))
          }

          return config
        }
      }

      dir = resolve(cwd, '../')
    } while (dir !== cwd)
  } catch (error) {
    return undefined
  }
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
