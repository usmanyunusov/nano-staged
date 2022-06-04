import process from 'process'
import tty from 'tty'
import os from 'os'

const REG_STR = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi

export function to_array(val) {
  return Array.isArray(val) ? val : [val]
}

export function* split_in_chunks(array, max_chunk_len) {
  let cur = []
  let len = 0

  for (const value of array) {
    let new_len = len + value.length

    if (new_len > max_chunk_len && cur.length > 0) {
      yield cur
      cur = []
      new_len = value.length
    }

    cur.push(value)
    len = new_len
  }

  if (cur.length > 0) {
    yield cur
  }
}

export function str_argv_to_array(str = '') {
  let args = []
  let match

  while (true) {
    match = REG_STR.exec(str)

    if (!match) {
      return args
    }

    for (let arg of [match[1], match[6], match[0]]) {
      if (typeof arg === 'string') {
        args.push(arg)
      }
    }
  }
}
