import readline from 'readline'
import c from 'picocolors'

const spinnerMap = new WeakMap()
const spinnerFrames = ['-', '\\', '|', '/']

function getSpinner() {
  let index = 0

  return () => {
    index = ++index % spinnerFrames.length
    return spinnerFrames[index]
  }
}

function getLines(str = '', width = 80) {
  return str
    .replace(/\u001b[^m]*?m/g, '')
    .split('\n')
    .reduce((col, l) => (col += Math.max(1, Math.ceil(l.length / width))), 0)
}

function getStateSymbol(task) {
  if (task.isDone()) {
    return c.green('√')
  } else if (task.isFail()) {
    return c.red('×')
  } else if (task.isWarn()) {
    return c.yellow('↓')
  } else if (task.isRun()) {
    let spinner = spinnerMap.get(task)

    if (!spinner) {
      spinner = getSpinner()
      spinnerMap.set(task, spinner)
    }

    return c.yellow(spinner())
  } else {
    return c.gray('*')
  }
}

function getTitles(task) {
  const titles = [task.title]
  let current = task

  while (current.parent) {
    current = current.parent
    if (current.title) titles.unshift(current.title)
  }

  return titles
}

function renderTree(tasks, level = 0) {
  let output = []

  for (const task of tasks) {
    const title = task.title
    const prefix = `${getStateSymbol(task)} `

    output.push('  '.repeat(level) + prefix + title)

    if (task.tasks && task.tasks.length > 0) {
      if (task.state !== 'done') {
        output = output.concat(renderTree(task.tasks, level + 1))
      }
    }
  }

  return output.join('\n')
}

function renderCI(tasks) {
  let output = ''

  for (const task of tasks) {
    if (task.state && !task.isEnd() && !task.isRun() && !task.tasks.length) {
      const title = getTitles(task).join(c.yellow(' ≫ '))
      const prefix = `${getStateSymbol(task)} `

      output += prefix + title + '\n'
      task.state$ = 'end'
    }

    if (task.tasks && task.tasks.length > 0) {
      output += renderCI(task.tasks)
    }
  }

  return output
}

export function createRenderer(stream, { isTTY = true } = {}) {
  let tasks = []
  let lines = 0
  let timer

  return {
    clear() {
      for (let i = 0; i < lines; i++) {
        i > 0 && readline.moveCursor(stream, 0, -1)
        readline.cursorTo(stream, 0)
        readline.clearLine(stream, 0)
      }
      lines = 0
    },

    write(str, clear = false) {
      if (clear) {
        this.clear()
      }

      stream.write(str)
    },

    render() {
      const output = isTTY ? renderTree(tasks) : renderCI(tasks)

      if (isTTY) {
        this.write(output, true)
        lines = getLines(output, stream.columns)
      } else {
        this.write(output)
      }

      return this
    },

    spin() {
      return this.render()
    },

    loop() {
      timer = setTimeout(() => this.loop(), 130)
      return this.spin()
    },

    start(task) {
      tasks.push(task)

      if (timer) return this
      if (isTTY) stream.write(`\x1b[?25l`)

      return this.loop()
    },

    stop() {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }

      if (isTTY) {
        this.write(`${renderTree(tasks)}\n`, true)
        this.write(`\x1b[?25h`)
      } else {
        this.write(renderCI(tasks))
      }

      return this
    },
  }
}
