#!/usr/bin/env node

import { get } from 'https'
import { styleText } from 'util'

async function getJSON(url) {
  const options = {
    headers: {
      'User-Agent': 'nano-staged',
    },
  }

  return new Promise((resolve) => {
    get(url, options, (res) => {
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
      styleText(
        'bold',
        Math.round(size / 1024)
          .toString()
          .padStart(4)
      ) +
      ' kB\n'
  )
}

async function start() {
  process.stdout.write(styleText('gray', 'Data from packagephobia.com\n'))
  await benchmark('lint-staged')
  await benchmark('nano-staged')
}

start()
