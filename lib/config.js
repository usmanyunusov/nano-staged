import { resolve } from 'path'
import fs from 'fs'

const NODE_PACKAGE_JSON = 'package.json'
const CONFIG_NAME = 'nano-staged'
const PLACES = [`.${CONFIG_NAME}.json`, `${CONFIG_NAME}.json`, NODE_PACKAGE_JSON]

export function readConfig(filepath) {
  if (fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()) {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  }
}

export function loadConfig(cwd = process.cwd()) {
  try {
    let config
    let dir = resolve(cwd)

    do {
      cwd = dir

      for (let place of PLACES) {
        let path = resolve(cwd, place)

        if (!config && fs.existsSync(path)) {
          if (place === NODE_PACKAGE_JSON) {
            config = readConfig(path)[CONFIG_NAME]
          } else {
            config = readConfig(path)
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
