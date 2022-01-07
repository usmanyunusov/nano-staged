import { pathToFileURL } from 'url'
import { resolve, extname } from 'path'
import fs from 'fs'

const NODE_PACKAGE_JSON = 'package.json'
const CONFIG_NAME = 'nano-staged'
const PLACES = [
  `.${CONFIG_NAME}.js`,
  `${CONFIG_NAME}.js`,
  `.${CONFIG_NAME}.cjs`,
  `${CONFIG_NAME}.cjs`,
  `.${CONFIG_NAME}.mjs`,
  `${CONFIG_NAME}.mjs`,
  `.${CONFIG_NAME}.json`,
  `${CONFIG_NAME}.json`,
  NODE_PACKAGE_JSON,
]

export async function readConfig(filepath) {
  if (fs.existsSync(filepath) && fs.lstatSync(filepath).isFile()) {
    if (extname(filepath) === '.json') {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
    }

    if (
      extname(filepath) === '.js' ||
      extname(filepath) === '.mjs' ||
      extname(filepath) === '.cjs'
    ) {
      let { default: config } = await import(pathToFileURL(filepath))

      if (typeof config === 'function') {
        return { '*': config }
      }

      return config
    }
  }
}

export async function loadConfig(cwd = process.cwd()) {
  try {
    let config
    let dir = resolve(cwd)

    do {
      cwd = dir

      for (let place of PLACES) {
        let path = resolve(cwd, place)

        if (!config && fs.existsSync(path)) {
          if (place === NODE_PACKAGE_JSON) {
            config = (await readConfig(path))[CONFIG_NAME]
          } else {
            config = await readConfig(path)
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
          typeof config[key] === 'function' ||
          (Array.isArray(config[key]) &&
            config[key].every((cmd) => cmd && typeof cmd === 'string')))
    )
  )
}
