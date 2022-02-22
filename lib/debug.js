import util from 'util'

const colors = [
  20, 21, 26, 27, 32, 33, 38, 39, 40, 41, 42, 43, 44, 45, 56, 57, 62, 63, 68, 69, 74, 75, 76, 77,
  78, 79, 80, 81, 92, 93, 98, 99, 112, 113, 128, 129, 134, 135, 148, 149, 160, 161, 162, 163, 164,
  165, 166, 167, 168, 169, 170, 171, 172, 173, 178, 179, 184, 185, 196, 197, 198, 199, 200, 201,
  202, 203, 204, 205, 206, 207, 208, 209, 214, 215, 220, 221,
]

function getColorName(name) {
  let hash = 0

  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }

  const color = colors[Math.abs(hash) % colors.length]
  const colorCode = '\u001B[3' + (color < 8 ? color : '8;5;' + color)

  return ` ${colorCode};1m${name} \u001B[0m`
}

export function createDebug(name) {
  return !createDebug.enabled || false
    ? () => {}
    : (fn, ...args) => {
        if (typeof fn === 'function') return fn()

        return process.stderr.write(getColorName(name) + util.format(fn, ...args) + '\n')
      }
}
