let all = new Map()

export function setCache(key, val) {
  all.set(key, val)
}

export function getCache(key) {
  return all.get(key)
}

export function delCache(key) {
  all.delete(key)
}

export function clearCache() {
  all.clear()
}

export function getAllCache() {
  return all
}
