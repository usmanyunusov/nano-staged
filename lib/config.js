import { resolve, parse } from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'

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

async function readConfig(path) {
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

export async function getConfig(cwd = process.cwd(), config = undefined) {
  try {
    if (config) {
      return typeof config === 'string' ? await readConfig(resolve(config)) : config
    }

    let up = resolve(cwd)

    do {
      cwd = up
      for (const place of places) {
        config = await readConfig(resolve(cwd, place))
        if (config) return config
      }
      up = resolve(cwd, '..')
    } while (up !== cwd)
  } catch {
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
