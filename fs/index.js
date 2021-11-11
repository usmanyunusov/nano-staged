import { promises as fs } from 'fs'

export function fileSystem() {
  return {
    async delete(files) {
      files = Array.isArray(files) ? files : [files]

      return await Promise.all(
        files.map(async (path) => {
          return await fs.unlink(path)
        })
      )
    },

    async read(files) {
      files = Array.isArray(files) ? files : [files]

      return await Promise.all(
        files
          .map(async (path) => {
            try {
              let source = await fs.readFile(path)
              return [path, source]
            } catch (err) {
              return []
            }
          })
          .filter(Boolean)
      )
    },

    async write(files) {
      files = Array.isArray(files) ? files : [files]

      return await Promise.all(
        files.map(async ([path, source]) => {
          return await fs.writeFile(path, source)
        })
      )
    },
  }
}
