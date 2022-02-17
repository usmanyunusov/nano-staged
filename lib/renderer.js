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

export function getStateSymbol(task) {
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

export function createRenderer(task, stream) {
  let tasks = Array.isArray(task) ? task : [task]
  let log = createLogUpdate(stream)
  let timer

  function update(tasks) {
    log(renderTree(tasks))
  }

  function loop() {
    timer = setTimeout(() => loop(), 130)
    update(tasks)
  }

  return {
    start() {
      if (timer) return this

      stream.write(`\x1b[?25l`)
      loop()
      return this
    },

    stop() {
      if (timer) timer = clearTimeout(timer)

      log.clear()
      stream.write(`${renderTree(tasks)}\n`)
      stream.write(`\x1b[?25h`)
      return this
    },

    register(task) {
      tasks.push(task)
      update(tasks)
      return this
    },
  }
}
