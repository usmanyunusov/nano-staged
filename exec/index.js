import { join, delimiter } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const IS_WINDOWS = process.platform === 'win32'

function endsWith(str, end) {
  return str.endsWith(end)
}

function isCmdFile(program) {
  const upperProgram = program.toUpperCase()
  return endsWith(upperProgram, '.CMD') || endsWith(upperProgram, '.BAT')
}

function getSpawnFileName(program) {
  if (IS_WINDOWS) {
    if (isCmdFile(program)) {
      return process.env['COMSPEC'] || 'cmd.exe'
    }
  }

  return program
}

function getSpawnArgs(program, args, options) {
  if (IS_WINDOWS) {
    if (isCmdFile(program)) {
      let argline = `/D /S /C "${windowsQuoteCmdArg(program, program)}`
      for (const a of args) {
        argline += ' '
        argline += options.windowsVerbatimArguments ? a : windowsQuoteCmdArg(program, a)
      }

      argline += '"'
      return [argline]
    }
  }

  return args
}

function windowsQuoteCmdArg(program, arg) {
  if (!isCmdFile(program)) {
    return uvQuoteCmdArg(arg)
  }

  if (!arg) {
    return '""'
  }

  const cmdSpecialChars = [
    ' ',
    '\t',
    '&',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
    '^',
    '=',
    ';',
    '!',
    "'",
    '+',
    ',',
    '`',
    '~',
    '|',
    '<',
    '>',
    '"',
  ]
  let needsQuotes = false
  for (const char of arg) {
    if (cmdSpecialChars.some((x) => x === char)) {
      needsQuotes = true
      break
    }
  }

  if (!needsQuotes) {
    return arg
  }

  let reverse = '"'
  let quoteHit = true
  for (let i = arg.length; i > 0; i--) {
    reverse += arg[i - 1]
    if (quoteHit && arg[i - 1] === '\\') {
      reverse += '\\'
    } else if (arg[i - 1] === '"') {
      quoteHit = true
      reverse += '"'
    } else {
      quoteHit = false
    }
  }

  reverse += '"'
  return reverse.split('').reverse().join('')
}

function uvQuoteCmdArg(arg) {
  if (!arg) {
    return '""'
  }

  if (!arg.includes(' ') && !arg.includes('\t') && !arg.includes('"')) {
    return arg
  }

  if (!arg.includes('"') && !arg.includes('\\')) {
    return `"${arg}"`
  }

  let reverse = '"'
  let quoteHit = true
  for (let i = arg.length; i > 0; i--) {
    reverse += arg[i - 1]
    if (quoteHit && arg[i - 1] === '\\') {
      reverse += '\\'
    } else if (arg[i - 1] === '"') {
      quoteHit = true
      reverse += '\\'
    } else {
      quoteHit = false
    }
  }

  reverse += '"'
  return reverse.split('').reverse().join('')
}

function getSpawnOptions(options, program) {
  options = options || {}
  const result = {}
  result.cwd = options.cwd
  result.env = options.env
  result['windowsVerbatimArguments'] = options.windowsVerbatimArguments || isCmdFile(program)
  if (options.windowsVerbatimArguments) {
    result.argv0 = `"${program}"`
  }
  return result
}

export async function exec(program, args, options = {}) {
  let opts = {
    preferLocal: false,
    ...options,
  }

  opts.env = {
    ...process.env,
    ...options.env,
  }

  if (opts.preferLocal) {
    opts.env[process.env.PATH ? 'PATH' : 'path'] =
      opts.env.PATH + delimiter + join(fileURLToPath(import.meta.url), '../../../.bin')
  }

  let child = spawn(program, args, opts)
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

  let promise = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output)
      } else {
        reject(output)
      }
    })
  })

  promise.child = child

  return promise
}
