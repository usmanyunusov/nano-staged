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

export function globrex(glob, opts = {}) {
  let { extended = false, globstar = false, flags = '' } = opts
  let code,
    next,
    pos = 0,
    regex = '',
    stack = [],
    inGroup = false,
    inRange = false,
    add = (str) => {
      regex += str
    }

  while (pos < glob.length) {
    code = glob.charCodeAt(pos)

    switch (code) {
      case BACKSLASH:
      case DOLLAR:
      case CARRET:
      case EQUALS:
      case POINT: {
        add(`\\${glob[pos]}`)
        break
      }

      case SLASH: {
        add(`\\${glob[pos]}`)
        if (glob.charCodeAt(pos + 1) === SLASH) {
          add('?')
        }
        break
      }

      case OPEN_PARENTHESES: {
        if (stack.length) {
          add(glob[pos])
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case CLOSE_PARENTHESES: {
        if (stack.length) {
          add(glob[pos])

          let type = stack.pop()
          if (type === '@') {
            add('{1}')
          } else if (type === '!') {
            add('([^/]*)')
          } else {
            add(type)
          }
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case PIPE: {
        if (stack.length) {
          add(glob[pos])
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case PLUS: {
        if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES && extended) {
          stack.push(glob[pos])
          break
        }

        add(`\\${glob[pos]}`)
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
            add(`^`)
            break
          }
          if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES) {
            stack.push(glob[pos])
            add(`(?!`)
            pos++
            break
          }

          add(`\\${glob[pos]}`)
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case QUESTION: {
        if (extended) {
          if (glob.charCodeAt(pos + 1) === OPEN_PARENTHESES) {
            stack.push(glob[pos])
          } else {
            add(`.`)
          }
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case OPEN_SQUARE: {
        if (inRange && glob.charCodeAt(pos + 1) === COLON) {
          next = glob.indexOf(':', pos + 2)

          let value = glob.slice(pos + 2, next)
          if (value === 'alnum') {
            add(`(\\w|\\d)`)
          } else if (value === 'space') {
            add(`\\s`)
          } else if (value === 'digit') {
            add(`\\d`)
          }

          pos = next + 1
          break
        }

        if (extended) {
          inRange = true
          add(glob[pos])
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case CLOSE_SQUARE: {
        if (extended) {
          inRange = false
          add(glob[pos])
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case OPEN_CURLY: {
        if (extended) {
          inGroup = true
          add(`(`)
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case CLOSE_CURLY: {
        if (extended) {
          inGroup = false
          add(`)`)
          break
        }

        add(`\\${glob[pos]}`)
        break
      }

      case COMA: {
        if (inGroup) {
          add(`|`)
          break
        }

        add(`\\${glob[pos]}`)
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
          add(`.*`)
        } else {
          let is_globstar =
            starCount > 1 &&
            (prevChar === '/' || prevChar === undefined) &&
            (nextChar === '/' || nextChar === undefined)
          if (is_globstar) {
            add(GLOBSTAR)
            pos++
          } else {
            add(WILDCARD)
          }
        }

        break
      }

      default: {
        add(glob[pos])
        break
      }
    }

    pos++
  }

  if (!flags.includes('g')) {
    regex = `^${regex}$`
  }

  return new RegExp(regex, flags)
}
