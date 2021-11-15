import { promises as fs } from 'fs'

import { toArray } from '../utils/index.js'

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
            let content = await fs.readFile(path)
            return { path, content }
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
        toArray(files).map(async ({ path, content }) => {
          return await fs.writeFile(path, content)
        })
      )
    },
  }
}
