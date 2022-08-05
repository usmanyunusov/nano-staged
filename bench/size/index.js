#!/usr/bin/env node

import { get } from 'https'
import c from '../../lib/colors.js'

async function getJSON(url) {
  return new Promise((resolve) => {
    get(url, (res) => {
      let text = ''
      res.on('data', (chunk) => {
        text += chunk
      })
      res.on('end', () => {
        resolve(JSON.parse(text))
      })
    })
  })
}

async function benchmark(lib) {
  let prefix = lib === 'nano-staged' ? '+ ' : '- '
  let data = await getJSON(`https://packagephobia.com/v2/api.json?p=${lib}`)
  let size = data.install.bytes
  process.stdout.write(
    prefix +
      lib.padEnd('lint-staged   '.length) +
      c.bold(
        Math.round(size / 1024)
          .toString()
          .padStart(4)
      ) +
      ' kB\n'
  )
}

async function start() {
  process.stdout.write(c.gray('Data from packagephobia.com\n'))
  await benchmark('lint-staged')
  await benchmark('nano-staged')
}

start()
