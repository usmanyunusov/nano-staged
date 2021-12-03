import { promises as fs } from 'fs'

import { toArray } from './utils.js'

export function fileSystem() {
  return {
    async delete(path) {
      if (Array.isArray(path)) {
        let paths = toArray(path)

        return await Promise.all(
          paths.map(async (path) => {
            return await fs.unlink(path)
          })
        )
      }

      return await fs.unlink(path)
    },

    async read(path) {
      if (Array.isArray(path)) {
        let paths = toArray(path)

        return (
          await Promise.all(
            paths.map(async (path) => {
              try {
                let content = await fs.readFile(path)
                return { path, content }
              } catch (err) {
                return null
              }
            })
          )
        ).filter(Boolean)
      }

      try {
        return await fs.readFile(path)
      } catch (err) {
        return null
      }
    },

    async write(path, content) {
      if (Array.isArray(path)) {
        let paths = toArray(path)

        return await Promise.all(
          paths.map(async ({ path, content }) => {
            return await fs.writeFile(path, content)
          })
        )
      }

      return await fs.writeFile(path, content)
    },
  }
}
