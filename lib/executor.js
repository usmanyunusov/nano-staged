/* c8 ignore start */
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

const IS_WINDOWS = process.platform === 'win32'
const ENV_PATH_KEY = getPathKey(process.env)
const RE_EXECUTABLE = /\.(?:com|exe)$/i
const RE_META_CHARS = /([()\][%!^"`<>&|;, *?])/g
const RE_IS_CMD_SHIM = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i

function escapeCommand(arg) {
  return arg.replace(RE_META_CHARS, '^$1')
}

function escapeArgument(arg, doubleEscapeMetaChars = false) {
  arg = `"` + `${arg}`.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1') + `"`
  arg = arg.replace(RE_META_CHARS, '^$1')

  if (doubleEscapeMetaChars) {
    arg = arg.replace(RE_META_CHARS, '^$1')
  }

  return arg
}

function getSpawnArgs(cmd, args) {
  if (IS_WINDOWS) {
    if (isCmdFile(cmd)) {
      let line = `/D /S /C "${escapeCommand(cmd)}`
      for (const arg of args) {
        line += ' '
        line += escapeArgument(arg, RE_IS_CMD_SHIM.test(cmd))
      }
      line += '"'

      return [line]
    }
  }

  return args
}

function endsWith(str, end) {
  return str.endsWith(end)
}

function isCmdFile(cmd) {
  let upperCMD = cmd.toUpperCase()
  return endsWith(upperCMD, '.CMD') || endsWith(upperCMD, '.BAT')
}

function getSpawnFileName(cmd) {
  if (IS_WINDOWS) {
    if (isCmdFile(cmd)) {
      return process.env['COMSPEC'] || 'cmd.exe'
    }
  }

  return cmd
}

async function getPrefix(root) {
  let original = (root = path.resolve(root))

  while (path.basename(root) === 'node_modules') {
    root = path.dirname(root)
  }

  if (original !== root) {
    return Promise.resolve(root)
  } else {
    return Promise.resolve(getPrefixFromTree(root))
  }
}

function getPrefixFromTree(current) {
  if (isRooted(current)) {
    return false
  } else {
    return Promise.all([
      fs.stat(path.join(current, 'package.json')).catch(() => ''),
      fs.stat(path.join(current, 'node_modules')).catch(() => ''),
    ]).then(([hasPkg, hasModules]) => {
      if (hasPkg || hasModules) {
        return current
      } else {
        return getPrefixFromTree(path.dirname(current))
      }
    })
  }
}

function getPathKey(env = process.env) {
  let pathKey = 'PATH'

  if (IS_WINDOWS) {
    pathKey = 'Path'

    for (const key in env) {
      if (key.toLowerCase() === 'path') {
        pathKey = key
      }
    }
  }

  return pathKey
}

function isRooted(p) {
  p = normalizeSeparators(p)

  if (IS_WINDOWS) {
    return p.match(/^[a-z]+:[/\\]?$/i)
  }

  return p === '/'
}

async function tryGetExecutablePath(filePath, extensions) {
  let stats = undefined
  try {
    stats = await fs.stat(filePath)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.log(
        `Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`
      )
    }
  }
  if (stats && stats.isFile()) {
    if (IS_WINDOWS) {
      const upperExt = path.extname(filePath).toUpperCase()
      if (extensions.some((validExt) => validExt.toUpperCase() === upperExt)) {
        return filePath
      }
    } else {
      if (isUnixExecutable(stats)) {
        return filePath
      }
    }
  }

  const originalFilePath = filePath
  for (const extension of extensions) {
    filePath = originalFilePath + extension

    stats = undefined
    try {
      stats = await fs.stat(filePath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.log(
          `Unexpected error attempting to determine if executable file exists '${filePath}': ${err}`
        )
      }
    }

    if (stats && stats.isFile()) {
      if (IS_WINDOWS) {
        try {
          const directory = path.dirname(filePath)
          const upperName = path.basename(filePath).toUpperCase()
          for (const actualName of await fs.readdir(directory)) {
            if (upperName === actualName.toUpperCase()) {
              filePath = path.join(directory, actualName)
              break
            }
          }
        } catch (err) {
          console.log(
            `Unexpected error attempting to determine the actual case of the file '${filePath}': ${err}`
          )
        }

        return filePath
      } else {
        if (isUnixExecutable(stats)) {
          return filePath
        }
      }
    }
  }

  return ''
}

function normalizeSeparators(p = '') {
  return IS_WINDOWS ? p.replace(/\//g, '\\').replace(/\\\\+/g, '\\') : p.replace(/\/\/+/g, '/')
}

function isUnixExecutable(stats) {
  return (
    (stats.mode & 1) > 0 ||
    ((stats.mode & 8) > 0 && stats.gid === process.getgid()) ||
    ((stats.mode & 64) > 0 && stats.uid === process.getuid())
  )
}

async function findInPath(tool) {
  let extensions = []
  let directories = []
  let matches = []

  if (IS_WINDOWS && process.env['PATHEXT']) {
    for (let extension of process.env['PATHEXT'].split(path.delimiter)) {
      if (extension) {
        extensions.push(extension)
      }
    }
  }

  if (isRooted(tool)) {
    let filePath = await tryGetExecutablePath(tool, extensions)

    if (filePath) {
      return [filePath]
    }

    return []
  }

  if (tool.includes(path.sep)) {
    return []
  }

  if (process.env[ENV_PATH_KEY]) {
    for (let p of process.env[ENV_PATH_KEY].split(path.delimiter)) {
      if (p) {
        directories.push(p)
      }
    }
  }

  for (let directory of directories) {
    let filePath = await tryGetExecutablePath(path.join(directory, tool), extensions)

    if (filePath) {
      matches.push(filePath)
    }
  }

  return matches
}

async function which(tool, check) {
  if (!tool) {
    throw `'tool' is required`
  }

  if (check) {
    let result = await which(tool, false)

    if (!result) {
      throw `${tool} does not exist`
    }

    return result
  }

  let matches = await findInPath(tool)

  if (matches && matches.length > 0) {
    return matches[0]
  }

  return ''
}

export async function executor(cmd, args = [], opts = {}) {
  let prefix = await getPrefix(process.cwd())

  if (prefix) {
    let local = path.join(prefix, 'node_modules', '.bin')
    process.env[ENV_PATH_KEY] = `${local}${path.delimiter}${process.env.PATH}`
  }

  let commandFile = await which(cmd, true)

  if (IS_WINDOWS && !RE_EXECUTABLE.test(commandFile)) {
    cmd = getSpawnFileName(commandFile)
    args = getSpawnArgs(commandFile, args)
    opts.windowsVerbatimArguments = true
  }

  let child = spawn(cmd, args, {
    ...opts,
    env: {
      ...process.env,
      ...opts.env,
    },
  })

  let output = ''

  if (child.stdout) {
    child.stdout.on('data', (data) => {
      output += data
    })
  }

  if (child.stderr) {
    child.stderr.on('data', (data) => {
      output += data
    })
  }

  return new Promise((resolve, reject) => {
    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(output)
      }
    })
  })
}

/* c8 ignore end */
