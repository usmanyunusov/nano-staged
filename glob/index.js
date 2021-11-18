/* c8 ignore start */

const isWin = process.platform === 'win32'
const SEP = isWin ? `\\\\+` : `\\/`
const SEP_ESC = isWin ? `\\\\` : `/`
const GLOBSTAR = `((?:[^/]*(?:/|$))*)`
const WILDCARD = `([^/]*)`
const GLOBSTAR_SEGMENT = `((?:[^${SEP_ESC}]*(?:${SEP_ESC}|$))*)`
const WILDCARD_SEGMENT = `([^${SEP_ESC}]*)`

export function glob(glob, opts = {}) {
  let { extended = false, globstar = false, strict = false, filepath = false, flags = '' } = opts
  let path = { regex: '', segments: [] }
  let segment = ''
  let regex = ''

  let inGroup = false
  let inRange = false

  const ext = []

  function add(str, { split, last, only } = {}) {
    if (only !== 'path') regex += str
    if (filepath && only !== 'regex') {
      path.regex += str === '\\/' ? SEP : str
      if (split) {
        if (last) segment += str
        if (segment !== '') {
          if (!flags.includes('g')) segment = `^${segment}$`
          path.segments.push(new RegExp(segment, flags))
        }
        segment = ''
      } else {
        segment += str
      }
    }
  }

  let c, n
  for (let i = 0; i < glob.length; i++) {
    c = glob[i]
    n = glob[i + 1]

    if (['\\', '$', '^', '.', '='].includes(c)) {
      add(`\\${c}`)
      continue
    }

    if (c === '/') {
      add(`\\${c}`, { split: true })
      if (n === '/' && !strict) regex += '?'
      continue
    }

    if (c === '(') {
      if (ext.length) {
        add(c)
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === ')') {
      if (ext.length) {
        add(c)
        let type = ext.pop()
        if (type === '@') {
          add('{1}')
        } else if (type === '!') {
          add('([^/]*)')
        } else {
          add(type)
        }
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '|') {
      if (ext.length) {
        add(c)
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '+') {
      if (n === '(' && extended) {
        ext.push(c)
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '@' && extended) {
      if (n === '(') {
        ext.push(c)
        continue
      }
    }

    if (c === '!') {
      if (extended) {
        if (inRange) {
          add('^')
          continue
        }
        if (n === '(') {
          ext.push(c)
          add('(?!')
          i++
          continue
        }
        add(`\\${c}`)
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '?') {
      if (extended) {
        if (n === '(') {
          ext.push(c)
        } else {
          add('.')
        }
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '[') {
      if (inRange && n === ':') {
        i++
        let value = ''
        while (glob[++i] !== ':') value += glob[i]
        if (value === 'alnum') add('(\\w|\\d)')
        else if (value === 'space') add('\\s')
        else if (value === 'digit') add('\\d')
        i++
        continue
      }
      if (extended) {
        inRange = true
        add(c)
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === ']') {
      if (extended) {
        inRange = false
        add(c)
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '{') {
      if (extended) {
        inGroup = true
        add('(')
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '}') {
      if (extended) {
        inGroup = false
        add(')')
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === ',') {
      if (inGroup) {
        add('|')
        continue
      }
      add(`\\${c}`)
      continue
    }

    if (c === '*') {
      if (n === '(' && extended) {
        ext.push(c)
        continue
      }

      let prevChar = glob[i - 1]
      let starCount = 1
      while (glob[i + 1] === '*') {
        starCount++
        i++
      }
      let nextChar = glob[i + 1]
      if (!globstar) {
        add('.*')
      } else {
        let isGlobstar =
          starCount > 1 &&
          (prevChar === '/' || prevChar === undefined) &&
          (nextChar === '/' || nextChar === undefined)
        if (isGlobstar) {
          add(GLOBSTAR, { only: 'regex' })
          add(GLOBSTAR_SEGMENT, { only: 'path', last: true, split: true })
          i++
        } else {
          add(WILDCARD, { only: 'regex' })
          add(WILDCARD_SEGMENT, { only: 'path' })
        }
      }
      continue
    }

    add(c)
  }

  if (!flags.includes('g')) {
    regex = `^${regex}$`
    segment = `^${segment}$`
    if (filepath) path.regex = `^${path.regex}$`
  }

  const result = { regex: new RegExp(regex, flags) }

  if (filepath) {
    path.segments.push(new RegExp(segment, flags))
    path.regex = new RegExp(path.regex, flags)
    path.globstar = new RegExp(
      !flags.includes('g') ? `^${GLOBSTAR_SEGMENT}$` : GLOBSTAR_SEGMENT,
      flags
    )
    result.path = path
  }

  return result
}

/* c8 ignore stop */
