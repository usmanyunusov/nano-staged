export function createCache() {
  let cache = new Map()

  return {
    set(key, val) {
      cache.set(key, val)
    },

    get(key) {
      return cache.get(key)
    },

    delete(key) {
      cache.delete(key)
    },

    clear() {
      cache.clear()
    },

    getAll() {
      return cache
    },
  }
}
