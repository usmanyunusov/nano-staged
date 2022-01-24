import { promises as fs } from 'fs'

export async function unlink(path) {
  return await fs.unlink(path)
}

export async function read(path) {
  try {
    return await fs.readFile(path)
  } catch (err) {
    return null
  }
}
