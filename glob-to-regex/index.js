const CLOSE_PARENTHESES = ')'.charCodeAt(0)
const OPEN_PARENTHESES = '('.charCodeAt(0)
const CLOSE_SQUARE = ']'.charCodeAt(0)
const OPEN_SQUARE = '['.charCodeAt(0)
const CLOSE_CURLY = '}'.charCodeAt(0)
const OPEN_CURLY = '{'.charCodeAt(0)
const BACKSLASH = '\\'.charCodeAt(0)
const ASTERISK = '*'.charCodeAt(0)
const QUESTION = '?'.charCodeAt(0)
const DOLLAR = '$'.charCodeAt(0)
const EQUALS = '='.charCodeAt(0)
const CARRET = '^'.charCodeAt(0)
const SLASH = '/'.charCodeAt(0)
const COLON = ':'.charCodeAt(0)
const POINT = '.'.charCodeAt(0)
const PIPE = '|'.charCodeAt(0)
const PLUS = '+'.charCodeAt(0)
const BANG = '!'.charCodeAt(0)
const COMA = ','.charCodeAt(0)
const AT = '@'.charCodeAt(0)

const GLOBSTAR = `((?:[^/]*(?:/|$))*)`
const WILDCARD = `([^/]*)`

export function globToRegex(glob, opts = {}) {
  let { extended = false, globstar = false, flags = '' } = opts

  let inRange = false
  let inGroup = false
  let stack = []
  let regex = ''
  let pos = 0

  let code, next

  while (pos < glob.length) {
    code = glob.charCodeAt(pos)

    switch (code) {
      case BACKSLASH:
      case DOLLAR:
      case CARRET:
      case EQUALS:
      case POINT: {
        regex += `\\${glob[pos]}`
        break
      }

      case SLASH: {
        regex += `\\${glob[pos]}`
        if (glob.charCodeAt(pos + 1) === SLASH) {
          regex += '?'
        }
        break
      }

      case OPEN_PARENTHESES: {
        if (stack.length) {
          regex += glob[pos]
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case CLOSE_PARENTHESES: {
        if (stack.length) {
          regex += glob[pos]

          let type = stack.pop()
          if (type === '@') {
            regex += '{1}'
          } else if (type === '!') {
            regex += '([^/]*)'
          } else {
            regex += type
          }
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case PIPE: {
        if (stack.length) {
          regex += glob[pos]
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case PLUS: {
        if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES && extended) {
          stack.push(glob[pos])
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case AT: {
        if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES && extended) {
          stack.push(glob[pos])
          break
        }
      }

      case BANG: {
        if (extended) {
          if (inRange) {
            regex += `^`
            break
          }
          if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES) {
            stack.push(glob[pos])
            regex += `(?!`
            pos++
            break
          }

          regex += `\\${glob[pos]}`
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case QUESTION: {
        if (extended) {
          if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES) {
            stack.push(glob[pos])
          } else {
            regex += `.`
          }
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case OPEN_SQUARE: {
        if (inRange && glob.charCodeAt(pos + 1) === COLON) {
          next = glob.indexOf(':', pos + 2)

          let value = glob.slice(pos + 2, next)
          if (value === 'alnum') {
            regex += `(\\w|\\d)`
          } else if (value === 'space') {
            regex += `\\s`
          } else if (value === 'digit') {
            regex += `\\d`
          }

          pos = next + 1
          break
        }

        if (extended) {
          inRange = true
          regex += glob[pos]
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case CLOSE_SQUARE: {
        if (extended) {
          inRange = false
          regex += glob[pos]
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case OPEN_CURLY: {
        if (extended) {
          inGroup = true
          regex += `(`
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case CLOSE_CURLY: {
        if (extended) {
          inGroup = false
          regex += `)`
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case COMA: {
        if (inGroup) {
          regex += `|`
          break
        }

        regex += `\\${glob[pos]}`
        break
      }

      case ASTERISK: {
        if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES && extended) {
          stack.push(glob[pos])
          break
        }

        let prevChar = glob[pos - 1]
        let starCount = 1
        while (glob.charCodeAt(pos + 1) === ASTERISK) {
          starCount++
          pos++
        }
        let nextChar = glob[pos + 1]

        if (!globstar) {
          regex += `.*`
        } else {
          let isGlobstar =
            starCount > 1 &&
            (prevChar === '/' || prevChar === undefined) &&
            (nextChar === '/' || nextChar === undefined)
          if (isGlobstar) {
            regex += GLOBSTAR
            pos++
          } else {
            regex += WILDCARD
          }
        }

        break
      }

      default: {
        regex += glob[pos]
        break
      }
    }

    pos++
  }

  if (!flags.includes('g')) {
    regex = `^${regex}$`
  }

  return { regex: new RegExp(regex, flags) }
}
