import readline from 'readline'
import c from 'picocolors'

const { green, red, yellow } = c

function getLines(str = '', width = 80) {
  return str
    .replace(/\u001b[^m]*?m/g, '')
    .split('\n')
    .reduce((col, l) => (col += Math.max(1, Math.ceil(l.length / width))), 0)
}

class Spin {
  spins = []
  runnnig = false
  result = ''

  constructor(spinner, text, level = 0) {
    this.level = level
    this.spinner = spinner
    this._text = text
  }

  get text() {
    let padding = ''.padEnd(this.level * 2)
    let mark = yellow(this.spinner.frames[this.spinner.frame])

    if (this.result) {
      return `${padding}${this.result}`
    }

    return `${padding}${mark} ${this._text}`
  }

  success() {
    this.result = `${green('√')} ${this._text}`
    return this
  }

  error(err) {
    this.result = `${red('×')} ${err || this._text}`
    return this
  }

  warning(text) {
    this.result = `${yellow('↓')} ${text || this._text}`
    return this
  }

  start() {
    this.result = ''
    this.runnnig = true

    if (this.spinner.timer) {
      return this
    }

    this.spinner.loop()
    return this
  }

  collups() {
    if (this.spins.length) {
      this.spins = []
    }
  }

  create(text) {
    let spin = new Spin(this.spinner, text, this.level + 1)
    this.spins.push(spin)

    return spin
  }
}

export class Spinner {
  frames = ['-', '\\', '|', '/']
  cursor = true
  timer = false
  spins = []
  frame = 0
  lines = 0

  constructor({ stream = process.stderr }) {
    this.stream = stream
  }

  write(str, clear = false) {
    if (clear) {
      this.clear()
    }

    this.stream.write(str)
  }

  clear() {
    for (let i = 0; i < this.lines; i++) {
      i > 0 && readline.moveCursor(this.stream, 0, -1)
      readline.cursorTo(this.stream, 0)
      readline.clearLine(this.stream, 0)
    }

    this.lines = 0
  }

  output(spins) {
    return spins
      .filter(({ runnnig }) => runnnig)
      .map(({ spins, text }) => {
        if (spins.length) {
          return text + '\n' + this.output(spins)
        }

        return text
      })
      .join('\n')
  }

  render(full = false) {
    let text = this.output(this.spins)

    this.write(full ? text + '\n' : text, true)
    this.lines = getLines(text, this.stream.columns)
  }

  spin() {
    this.frame = ++this.frame % this.frames.length
    this.render()
  }

  hideCursor() {
    if (this.cursor) {
      this.cursor = false
      this.write(`\x1b[?25l`)
    }
  }

  showCursor() {
    if (!this.cursor) {
      this.cursor = true
      this.write(`\x1b[?25h`)
    }
  }

  loop() {
    this.hideCursor()
    this.timer = setTimeout(() => this.loop(), 120)
    this.spin()
  }

  stop() {
    if (this.timer) {
      this.timer = clearTimeout(this.timer)
      this.render(true)
      this.showCursor()
    }
  }

  create(text, level) {
    let spin = new Spin(this, text, level)
    this.spins.push(spin)

    return spin
  }
}
