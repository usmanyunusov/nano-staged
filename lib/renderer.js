import readline from 'readline'
import c from 'picocolors'

const spinnerMap = new WeakMap()
const spinnerFrames = ['-', '\\', '|', '/']
const isTTY = process.stdout.isTTY && !process.env.CI

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
  if (task.state === 'done') {
    return c.green('√')
  } else if (task.state === 'fail') {
    return c.red('×')
  } else if (task.state === 'warn') {
    return c.yellow('↓')
  } else if (task.state === 'run') {
    let spinner = spinnerMap.get(task)

    if (!spinner) {
      spinner = getSpinner()
      spinnerMap.set(task, spinner)
    }

    return c.yellow(spinner())
  } else {
    return c.gray('◼')
  }
}

function createLogUpdate(stream) {
  let lines = 0

  function clear() {
    for (let i = 0; i < lines; i++) {
      i > 0 && readline.moveCursor(stream, 0, -1)
      readline.cursorTo(stream, 0)
      readline.clearLine(stream, 0)
    }
    lines = 0
  }

  function render(output) {
    clear()

    stream.write(output)
    lines = getLines(output, stream.columns)
  }

  render.clear = () => {
    clear()
  }

  return render
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
    if (task.state && task.state !== 'end' && task.state !== 'run' && !task.tasks) {
      const title = getTitles(task).join(c.dim(' > '))
      const prefix = `${getStateSymbol(task)} `

      output += prefix + title + '\n'
      task.state = 'end'
    }

    if (task.tasks && task.tasks.length > 0) {
      output += renderCI(task.tasks)
    }
  }

  return output
}

export function createRenderer(stream) {
  let log = createLogUpdate(stream)
  let tasks = []
  let timer

  function update() {
    if (isTTY) {
      log(renderTree(tasks))
    } else {
      stream.write(renderCI(tasks))
    }
  }

  function loop() {
    timer = setTimeout(() => loop(), 130)
    update()
  }

  return {
    start() {
      if (timer) return this
      if (isTTY) stream.write(`\x1b[?25l`)

      loop()
      return this
    },

    stop() {
      if (timer) timer = clearTimeout(timer)

      if (isTTY) {
        log.clear()
        stream.write(`${renderTree(tasks)}\n`)
        stream.write(`\x1b[?25h`)
      } else {
        stream.write(renderCI(tasks))
      }

      return this
    },

    update(task) {
      tasks.push(task)
      update()

      return this
    },
  }
}
