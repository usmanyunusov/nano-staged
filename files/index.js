import { promises as fs } from 'fs'

export async function deleteFiles(files) {
  files = Array.isArray(files) ? files : [files]

  return await Promise.all(
    files.map(async (path) => {
      return await fs.unlink(path)
    })
  )
}

export async function readFiles(files) {
  files = Array.isArray(files) ? files : [files]

  return await Promise.all(
    files
      .map(async (path) => {
        try {
          let source = await fs.readFile(path)
          return [path, source]
        } catch (err) {
          return null
        }
      })
      .filter(Boolean)
  )
}

export async function writeFiles(files) {
  files = Array.isArray(files) ? files : [files]

  return await Promise.all(
    files.map(async ([path, source]) => {
      return await fs.writeFile(path, source)
    })
  )
}
