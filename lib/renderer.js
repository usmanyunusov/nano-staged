import readline from 'readline'

import c from './colors.js'

const spinners = new WeakMap()

function get_spinner(task) {
  let spinner = spinners.get(task)

  if (!spinner) {
    let i = 0
    spinner = () => ['-', '\\', '|', '/'][i++ % 4]
    spinners.set(task, spinner)
  }

  return spinner()
}

function get_lines(str = '', width = 80) {
  return str
    .replace(/\u001b[^m]*?m/g, '')
    .split('\n')
    .reduce((col, l) => (col += Math.max(1, Math.ceil(l.length / width))), 0)
}

function get_state_symbol(task) {
  switch (task.state) {
    case 'success': {
      return c.green('√')
    }
    case 'error': {
      return c.red('×')
    }
    case 'warning': {
      return c.yellow('↓')
    }
    case 'loading': {
      return c.yellow(get_spinner(task))
    }
    default: {
      return c.gray('*')
    }
  }
}

function get_titles(task) {
  let titles = [task.title]
  let current = task

  while (current.parent) {
    current = current.parent
    if (current.title) titles.unshift(current.title)
  }

  return titles
}

function render_default(root, level = 0) {
  let output = []

  for (const task of root.children) {
    const title = task.title
    const prefix = `${get_state_symbol(task)} `

    output.push('  '.repeat(level) + prefix + title)

    if (task.children && task.children.length > 0) {
      if (task.state !== 'success') {
        output = output.concat(render_default(task, level + 1))
      }
    }
  }

  return output.join('\n')
}

function render_verbose(root) {
  let output = ''

  for (const task of root.children) {
    if (
      task.state !== 'done' &&
      task.state !== 'pending' &&
      task.state !== 'loading' &&
      task.children.length === 0
    ) {
      const title = get_titles(task).join(c.yellow(' ≫ '))
      const prefix = `${get_state_symbol(task)} `

      output += prefix + title + '\n'
      task.state = 'done'
    }

    if (task.children && task.children.length > 0) {
      output += render_verbose(task)
    }
  }

  return output
}

export function create_renderer(root, { stream = process.stderr, is_tty = true } = {}) {
  let lines = 0
  let timer

  const renderer = {
    is_tty,
    clear() {
      for (let i = 0; i < lines; i++) {
        i > 0 && readline.moveCursor(stream, 0, -1)
        readline.cursorTo(stream, 0)
        readline.clearLine(stream, 0)
      }
    },

    write(str, is_clear = false) {
      if (is_clear) {
        this.clear()
        lines = 0
      }

      stream.write(str)
    },

    render() {
      const output = this.is_tty ? render_default(root) : render_verbose(root)

      this.write(output, this.is_tty)
      lines = get_lines(output, stream.columns)

      return this
    },

    loop() {
      timer = this.is_tty ? setTimeout(() => this.loop(), 130) : true
      return this.render()
    },

    start() {
      if (timer) return this
      if (this.is_tty) stream.write(`\x1b[?25l`)

      return this.loop()
    },

    stop() {
      if (!timer) return this

      timer = this.is_tty ? clearTimeout(timer) : false

      if (this.is_tty) {
        this.write(`${render_default(root)}\n`, true)
        this.write(`\x1b[?25h`)
      } else {
        this.write(render_verbose(root))
      }
    },
  }

  return renderer
}
