import * as url from 'url'
import * as p from 'path'
import * as fs from 'fs'

import { create_debug } from './debug.js'
import { normalize } from './utils.js'

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

const debug = create_debug('nano-staged:config')

async function read(path) {
  const has_file = fs.existsSync(path) && fs.lstatSync(path).isFile()

  if (!has_file) {
    return
  }

  const { ext, name } = p.parse(path)

  if (['.json', '.nanostagedrc'].includes(ext)) {
    const config = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }))
    return name === 'package' ? config['nano-staged'] : config
  }

  if (['.js', '.mjs', '.cjs'].includes(ext)) {
    const config = await import(url.pathToFileURL(path)).then((module) => module.default)
    return typeof config === 'function' ? { '*': config } : config
  }
}

async function find(cwd = process.cwd()) {
  debug('Searching for configuration from `%s`...', cwd)

  let up = p.resolve(cwd)
  let path

  try {
    do {
      cwd = up
      for (const place of places) {
        path = normalize(p.join(cwd, place))
        const config = await read(path)

        if (config) {
          debug('Successfully loaded config from `%s`:\n%O', path, config)
          return { path, config }
        }
      }
      up = p.resolve(cwd, '..')
    } while (up !== cwd)
  } catch {
    debug('Failed to load configuration `%s`', path)
    return { path, config: null }
  }

  return { path, config: null }
}

export function validate(config) {
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

export async function search({ cwd, search_dirs, config_path, config_obj }) {
  if (config_obj) {
    debug('Using single direct configuration object...')
    return { '': config_obj }
  }

  if (config_path) {
    debug('Using single configuration path...')
    const config = await read(config_path)
    return config ? { [config_path]: config } : {}
  }

  const configs = {}
  const passible_configs = await Promise.all(search_dirs.map((dir) => find(dir)))
  const sorted_configs = passible_configs.sort((a, b) =>
    a.path.split('/').length > b.path.split('/').length ? -1 : 1
  )

  debug('Found possible config files:\n', sorted_configs)

  for (const { config, path } of sorted_configs) {
    if (path.startsWith(normalize(cwd))) {
      configs[path] = config
    }
  }

  if (Object.keys(configs).length === 0) {
    const { config, path } = await find(cwd)

    if (config) {
      configs[config] = path
    }
  }

  return configs
}

export function group_files({ configs, files, is_single }) {
  const files_set = new Set(files)
  const files_by_config = {}

  for (const [path, config] of Object.entries(configs)) {
    if (is_single) {
      files_by_config[path] = { config, files }
      break
    }

    const dir = normalize(p.dirname(path))

    const include_all_files = Object.keys(config).some((glob) => glob.startsWith('..'))
    const scoped_files = new Set(include_all_files ? files_set : undefined)

    if (!include_all_files) {
      for (const file of files_set) {
        const rel = p.relative(dir, file)

        if (rel && !rel.startsWith('..') && !p.isAbsolute(rel)) {
          scoped_files.add(file)
        }
      }
    }

    for (const file of scoped_files) {
      files_set.delete(file)
    }

    files_by_config[path] = { config, files: Array.from(scoped_files) }
  }

  debug('Files by config:\n', files_by_config)

  return files_by_config
}
