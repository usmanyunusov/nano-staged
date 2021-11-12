import { toArray } from '../utils/index.js'
import { promises as fs } from 'fs'

export function fileSystem() {
  return {
    async delete(files) {
      files = toArray(files)

      return await Promise.all(
        files.map(async (path) => {
          return await fs.unlink(path)
        })
      )
    },

    async read(files) {
      files = toArray(files)

      let promises = await Promise.all(
        files.map(async (path) => {
          try {
            let source = await fs.readFile(path)
            return { path, source }
          } catch (err) {
            return null
          }
        })
      )

      return promises.filter(Boolean)
    },

    async write(files) {
      files = toArray(files)

      return await Promise.all(
        toArray(files).map(async ({ path, source }) => {
          return await fs.writeFile(path, source)
        })
      )
    },
  }
}
