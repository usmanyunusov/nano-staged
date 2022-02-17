import c from 'picocolors'

import { getStateSymbol } from './renderer.js'
import { getTitles, isTTY } from './utils.js'

export function createTask(obj) {
  const task = {
    title: '',
    tasks: [],
    result: {
      state: '',
    },
    skipped: () => false,
    ...obj,

    get state() {
      return task.result.state
    },

    set state(value) {
      task.result.state = value

      if (task.result.state !== 'run' && !isTTY && task.tasks.length === 0) {
        const prefix = `${getStateSymbol(task)} `
        const title = getTitles(task).join(c.dim(' > '))

        process.stderr.write(prefix + title + '\n')
      }
    },
  }

  return task
}
