import { join, delimiter } from 'path'
import spawn from 'cross-spawn'
import { fileURLToPath } from 'url'

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
