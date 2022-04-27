import { spawn } from 'child_process'
import pathlib from 'path'
import fs from 'fs'

const IS_WINDOWS = process.platform === 'win32'
const RE_EXECUTABLE = /\.(?:com|exe)$/i
const RE_META_CHARS = /([()\][%!^"`<>&|;, *?])/g
const RE_IS_CMD_SHIM = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i
const RE_SHEBANG = /^#!(.*)/
const MAX_BUFFER = 1000 * 1000 * 100

function esc_cmd(str) {
  return str.replace(RE_META_CHARS, '^$1')
}

function esc_arg(str, double = false) {
  str = `"` + `${str}`.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1') + `"`
  str = esc_cmd(str)

  return double ? esc_cmd(str) : str
}

function is_exe(path, options) {
  let stat = fs.statSync(path)
  let pathext = options.pathExt !== undefined ? options.pathExt : process.env.PATHEXT

  if (!stat.isSymbolicLink() && !stat.isFile()) {
    return false
  }

  if (!pathext) {
    return true
  }

  pathext = pathext.split(';')

  if (pathext.indexOf('') !== -1) {
    return true
  }

  for (const pext of pathext) {
    const p = pext.toLowerCase()

    if (p && path.substr(-p.length).toLowerCase() === p) {
      return true
    }
  }

  return false
}

function get_path_key(env = process.env, path_key = 'PATH') {
  if (IS_WINDOWS) {
    path_key = 'Path'

    for (const key in env) {
      if (key.toLowerCase() === 'path') {
        return key
      }
    }
  }

  return path_key
}

function get_env_path(cwd) {
  let entries = []
  let cur = cwd

  while (true) {
    entries.push(pathlib.join(cur, 'node_modules', '.bin'))
    const parent = pathlib.dirname(cur)
    if (parent === cur) {
      break
    }
    cur = parent
  }

  entries.push(process.env.PATH)
  return entries.join(pathlib.delimiter)
}

function get_path_info(cmd, opts) {
  const colon = IS_WINDOWS ? ';' : ':'

  const pathEnv =
    cmd.match(/\//) || (IS_WINDOWS && cmd.match(/\\/))
      ? ['']
      : [
          ...(IS_WINDOWS ? [process.cwd()] : []),
          ...(opts.path || process.env.PATH || '').split(colon),
        ]
  const pathExtExe = IS_WINDOWS ? opts.pathExt || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM' : ''
  const pathExt = IS_WINDOWS ? pathExtExe.split(colon) : ['']

  if (IS_WINDOWS) {
    if (cmd.indexOf('.') !== -1 && pathExt[0] !== '') pathExt.unshift('')
  }

  return {
    pathEnv,
    pathExt,
    pathExtExe,
  }
}

const which_sync = (cmd, opts = {}) => {
  const { pathEnv, pathExt, pathExtExe } = get_path_info(cmd, opts)

  for (const ppRaw of pathEnv) {
    const pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw

    const p_cmd = pathlib.join(pathPart, cmd)
    const p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + p_cmd : p_cmd

    for (const pExt of pathExt) {
      const cur = p + pExt

      try {
        if (is_exe(cur, { pathExt: pathExtExe })) {
          return cur
        }
      } catch {}
    }
  }

  throw new Error(`not found: ${cmd}`)
}

function resolve_cmd_attemp(parsed, withoutPathExt) {
  const env = parsed.opts.env || process.env
  const cwd = process.cwd()
  const has_custom_cwd = parsed.opts.cwd != null
  const should_switch_cwd = has_custom_cwd && process.chdir !== undefined && !process.chdir.disabled
  const path_key = get_path_key(env)

  if (should_switch_cwd) {
    try {
      process.chdir(parsed.opts.cwd)
    } catch {}
  }

  let resolved

  try {
    resolved = which_sync(parsed.cmd, {
      path: env[path_key],
      pathExt: withoutPathExt ? pathlib.delimiter : undefined,
    })
  } catch {
  } finally {
    if (should_switch_cwd) {
      process.chdir(cwd)
    }
  }

  if (resolved) {
    resolved = pathlib.resolve(has_custom_cwd ? parsed.opts.cwd : '', resolved)
  }

  return resolved
}

function resolve_cmd(parsed) {
  return resolve_cmd_attemp(parsed) || resolve_cmd_attemp(parsed, true)
}

function shebang_cmd(str = '') {
  const match = str.match(RE_SHEBANG)

  if (!match) {
    return null
  }

  const [path, argument] = match[0].replace(/#! ?/, '').split(' ')
  const binary = path.split('/').pop()

  return binary === 'env' ? argument : argument ? `${binary} ${argument}` : binary
}

function shebang_read(cmd) {
  const size = 150
  const buffer = Buffer.alloc(size)

  let fd

  try {
    fd = fs.openSync(cmd, 'r')
    fs.readSync(fd, buffer, 0, size, 0)
    fs.closeSync(fd)
  } catch {}

  return shebang_cmd(buffer.toString())
}

function shebang_detect(parsed) {
  parsed.file = resolve_cmd(parsed)

  const shebang = parsed.file && shebang_read(parsed.file)

  if (shebang) {
    parsed.args.unshift(parsed.file)
    parsed.cmd = shebang
    return resolve_cmd(parsed)
  }

  return parsed.file
}

export function executor(cmd, args = [], opts = {}) {
  let resolve, reject
  let promise = new ProcessPromise((...args) => ([resolve, reject] = args))

  promise.ctx = {
    cmd,
    args,
    opts,
    resolve,
    reject,
  }

  setImmediate(() => promise.run())

  return promise
}

class ProcessPromise extends Promise {
  get parsed() {
    const { cmd, args, opts } = this.ctx
    const $parsed = { cmd, args, opts, file: undefined }

    if (IS_WINDOWS) {
      const cmd_file = shebang_detect($parsed)

      if (!RE_EXECUTABLE.test(cmd_file)) {
        $parsed.cmd = esc_cmd(pathlib.normalize($parsed.cmd))
        $parsed.args = $parsed.args.map((arg) => esc_arg(arg, RE_IS_CMD_SHIM.test(cmd_file)))
        $parsed.args = ['/d', '/s', '/c', `"${[$parsed.cmd, ...$parsed.args].join(' ')}"`]
        $parsed.cmd = process.env.comspec || 'cmd.exe'
        $parsed.opts.windowsVerbatimArguments = true
      }
    }

    $parsed.opts = {
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
      buffer: true,
      ...$parsed.opts,
      env: {
        ...$parsed.opts.env,
        ...process.env,
        PATH: get_env_path($parsed.opts.cwd),
      },
    }

    if (IS_WINDOWS && pathlib.basename($parsed.cmd, '.exe') === 'cmd') {
      $parsed.args.unshift('/q')
    }

    return $parsed
  }

  output(str) {
    const LF = typeof str === 'string' ? '\n' : '\n'.charCodeAt()
    const CR = typeof str === 'string' ? '\r' : '\r'.charCodeAt()

    if (str[str.length - 1] === LF) str = str.slice(0, -1)
    if (str[str.length - 1] === CR) str = str.slice(0, -1)

    return str
  }

  run() {
    const { resolve, reject } = this.ctx
    const { cmd, args, opts } = this.parsed

    let child = spawn(cmd, args, opts)

    let combined = ''
    let on_stdout = (data) => (combined += data)
    let on_stderr = (data) => (combined += data)

    child.on('error', () => reject(this.output(combined)))
    child.on('close', (code) => {
      ;(code === 0 ? resolve : reject)(this.output(combined))
    })

    child.stdout.on('data', on_stdout)
    child.stderr.on('data', on_stderr)
  }
}
