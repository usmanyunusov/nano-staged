import readline from 'readline'
import c from './colors.js'

let spinners = new WeakMap()
let renderer

function get_spinner(task) {
  let spinner = spinners.get(task)

  if (!spinner) {
    let i = 0
    spinner = () => '\\|/-'[i++ % 4]
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

function get_symbol(task) {
  const nesting = task.children.length > 0
  const symbols = {
    success: c.green('√'),
    error: c.red(nesting ? '❯' : '×'),
    warning: c.yellow('↓'),
    loading: c.yellow(nesting ? '❯' : get_spinner(task)),
  }

  return symbols[task.state] || c.gray('*')
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

function multiline_render(root, level = 0) {
  let output = []

  for (const task of root.children) {
    const title = task.title
    const prefix = `${get_symbol(task)} `

    output.push('  '.repeat(level) + prefix + title)

    if (task.children.length > 0 && task.state !== 'success') {
      output = output.concat(multiline_render(task, level + 1))
    }
  }

  return output.join('\n')
}

function line_render(root) {
  let output = ''

  for (const task of root.children) {
    if (
      task.state !== 'done' &&
      task.state !== 'pending' &&
      task.state !== 'loading' &&
      task.children.length === 0
    ) {
      const title = get_titles(task).join(c.yellow(' ≫ '))
      const prefix = `${get_symbol(task)} `

      output += prefix + title + '\n'
      task.state = 'done'
    }

    if (task.children.length > 0) {
      output += line_render(task)
    }
  }

  return output
}

function create_renderer(root, { stream = process.stderr, is_tty = true } = {}) {
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
      const output = this.is_tty ? multiline_render(root) : line_render(root)

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
        this.write(`${multiline_render(root)}\n`, true)
        this.write(`\x1b[?25h`)
      } else {
        this.write(line_render(root))
      }
    },
  }

  return renderer
}

function register(root, title, fn, opts) {
  const index = root.children.push({
    error: undefined,
    state: 'pending',
    parent: root,
    children: [],
    skip: false,
    title,
  })

  const task = root.children[index - 1]

  return {
    task,
    async run() {
      try {
        task.state = 'loading'

        await fn({
          spinner: create_spinner(task, opts),
          update(next) {
            for (let key in next) {
              task[key] = next[key]
            }
          },
        })
      } catch (error) {
        task.state = 'error'
        task.error = error
      } finally {
        if (task.state === 'loading') {
          task.state = 'success'
        }

        if (!renderer.is_tty) {
          renderer.render()
        }
      }
    },
  }
}

export const create_spinner = (root, opts) => {
  if (!renderer) {
    renderer = create_renderer(root, opts)
  }

  const spinner = async (title, fn) => {
    const task = register(root, title, fn, opts)
    await task.run()

    return {
      get state() {
        return task.task.state
      },
      get error() {
        return task.task.error
      },
    }
  }

  spinner.skip = false
  spinner.start = renderer.start.bind(renderer)
  spinner.stop = renderer.stop.bind(renderer)
  spinner.group = async (create_tasks) => {
    const tasks = await create_tasks((title, fn) => register(root, title, fn, opts))

    for (const task of tasks) {
      await task.run()
    }
  }

  return spinner
}
