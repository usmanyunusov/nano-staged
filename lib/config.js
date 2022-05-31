import { resolve, parse } from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'

import { create_debug } from './debug.js'

const places = [
  `.nano-staged.js`,
  `nano-staged.js`,
  `.nano-staged.cjs`,
  `nano-staged.cjs`,
  `.nano-staged.mjs`,
  `nano-staged.mjs`,
  `.nano-staged.json`,
  `nano-staged.json`,
  `.nanostagedrc`,
  'package.json',
]

async function read_config(path) {
  if (fs.existsSync(path) && fs.lstatSync(path).isFile()) {
    const { ext, name } = parse(path)

    if (ext === '.json' || name === '.nanostagedrc') {
      const config = JSON.parse(fs.readFileSync(path, 'utf-8'))
      return name === 'package' ? config['nano-staged'] : config
    }

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      const { default: config } = await import(pathToFileURL(path))
      return typeof config === 'function' ? { '*': config } : config
    }
  }
}

export async function get_config(cwd = process.cwd(), config = undefined) {
  const debug = create_debug('nano-staged:config')

  try {
    if (config) {
      debug('Loading configuration from `%s`...', config)
      return typeof config === 'string' ? await read_config(resolve(config)) : config
    }

    debug('Searching for configuration from `%s`...', cwd)

    let up = resolve(cwd)

    do {
      cwd = up
      for (const place of places) {
        const path = resolve(cwd, place)
        config = await read_config(path)

        if (config) {
          debug('Successfully loaded config from `%s`:\n%O', path, config)
          return config
        }
      }
      up = resolve(cwd, '..')
    } while (up !== cwd)
  } catch {
    debug('Failed to load configuration!')
    return undefined
  }
}

export function valid_config(config) {
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
            config[key].every(
              (cmd) => (cmd && typeof cmd === 'string') || typeof cmd === 'function'
            )))
    )
  )
}
