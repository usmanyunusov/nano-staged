import { spawn } from 'child_process'
import * as p from 'path'
import * as fs from 'fs'

import { normalize } from './utils.js'

const RE_IS_CMD_SHIM = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i
const RE_META_CHARS = /([()\][%!^"`<>&|;, *?])/g
const RE_EXECUTABLE = /\.(?:com|exe)$/i
const RE_SHEBANG = /^#!(.*)/
const SPACES_REGEXP = / +/g

const IS_WINDOWS = process.platform === 'win32'
const MAX_BUFFER = 1000 * 1000 * 100

function esc_cmd(str) {
  return str.replace(RE_META_CHARS, '^$1')
}

function esc_arg(str, double = false) {
  str = `"` + `${str}`.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1') + `"`
  str = esc_cmd(str)

  return double ? esc_cmd(str) : str
}

function is_exe(path, opts) {
  let stat = fs.statSync(path)
  let exts = opts.path_ext !== undefined ? opts.path_ext : process.env.PATHEXT

  if (!stat.isSymbolicLink() && !stat.isFile()) return false
  if (!exts) return true

  exts = exts.split(';')
  if (exts.indexOf('') !== -1) return true

  for (const ext of exts) {
    const $ext = ext.toLowerCase()
    if ($ext && path.substr(-$ext.length).toLowerCase() === $ext) {
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
    entries.push(p.join(cur, 'node_modules', '.bin'))
    const parent = p.dirname(cur)
    if (parent === cur) {
      break
    }
    cur = parent
  }

  entries.push(process.env.PATH)
  return entries.join(p.delimiter)
}

function get_path_info(cmd, opts) {
  const colon = IS_WINDOWS ? ';' : ':'

  const path_env =
    cmd.match(/\//) || (IS_WINDOWS && cmd.match(/\\/))
      ? ['']
      : [
          ...(IS_WINDOWS ? [process.cwd()] : []),
          ...(opts.path || process.env.PATH || '').split(colon),
        ]
  const path_ext_exe = IS_WINDOWS
    ? opts.path_ext || process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM'
    : ''
  const path_ext = IS_WINDOWS ? path_ext_exe.split(colon) : ['']

  if (IS_WINDOWS) {
    if (cmd.indexOf('.') !== -1 && path_ext[0] !== '') path_ext.unshift('')
  }

  return {
    path_ext_exe,
    path_env,
    path_ext,
  }
}

const which_sync = (cmd, opts = {}) => {
  const { path_ext_exe, path_env, path_ext } = get_path_info(cmd, opts)

  for (const env of path_env) {
    const path_part = /^".*"$/.test(env) ? env.slice(1, -1) : env

    const p_cmd = p.join(path_part, cmd)
    const pp = !path_part && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + p_cmd : p_cmd

    for (const ext of path_ext) {
      const cur = pp + ext

      try {
        if (is_exe(cur, { path_ext: path_ext_exe })) {
          return cur
        }
      } catch {}
    }
  }

  throw new Error(`not found: ${cmd}`)
}

function resolve_cmd_attemp(parsed, without_path_ext) {
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
      path_ext: without_path_ext ? p.delimiter : undefined,
    })
  } catch {
  } finally {
    if (should_switch_cwd) {
      process.chdir(cwd)
    }
  }

  if (resolved) {
    resolved = p.resolve(has_custom_cwd ? parsed.opts.cwd : '', resolved)
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

export const parse_cmd = (cmd) => {
  const tokens = []

  for (const token of cmd.trim().split(SPACES_REGEXP)) {
    const prev_token = tokens[tokens.length - 1]
    if (prev_token && prev_token.endsWith('\\')) {
      tokens[tokens.length - 1] = `${prev_token.slice(0, -1)} ${token}`
    } else {
      tokens.push(token)
    }
  }

  return tokens
}

export function executor(cmd, args = [], opts = {}) {
  let resolve, reject
  let promise = new ProcessPromise((...args) => ([resolve, reject] = args))

  promise._bind(cmd, args, opts, resolve, reject)
  setImmediate(() => promise._run())

  return promise
}

export function executor_cmds(cmd, opts) {
  const [file, ...args] = parse_cmd(cmd)
  return executor(file, args, opts)
}

class ProcessPromise extends Promise {
  _bind(cmd, args, opts, resolve, reject) {
    this._cmd = cmd
    this._args = args
    this._opts = opts
    this._reject = reject
    this._resolve = resolve
  }

  _run() {
    const { cmd, args, opts } = this._parsed()

    let child = spawn(cmd, args, opts)

    let combined = ''
    let on_stdout = (data) => (combined += data)
    let on_stderr = (data) => (combined += data)

    child.on('error', () => {
      this._reject(this.output(combined))
    })
    child.on('close', (code) => {
      const out = this.output(combined)

      if (code === 0) {
        this._resolve(out)
      } else {
        this._reject(out)
      }
    })

    child.stdout.on('data', on_stdout)
    child.stderr.on('data', on_stderr)
  }

  _parsed() {
    const $parsed = {
      cmd: this._cmd,
      args: this._args,
      opts: this._opts,
      file: undefined,
    }

    if (IS_WINDOWS && !this._opts.shell) {
      const cmd_file = shebang_detect($parsed)

      if (!RE_EXECUTABLE.test(cmd_file)) {
        $parsed.cmd = esc_cmd(normalize($parsed.cmd))
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

    if (IS_WINDOWS && p.basename($parsed.cmd, '.exe') === 'cmd') {
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
}
