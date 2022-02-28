export class Task {
  constructor(task) {
    this.task = task
    this.title = task.title
    this.run = task.run
    this.isSkip =
      task.isSkip ||
      function () {
        return false
      }
    this.pattern = task.pattern || ''
    this.tasks = task.tasks || []
    this.file_count = task.file_count || 0
    this.state = null
  }

  set state$(state) {
    this.state = state
  }

  isRun() {
    return this.state === 'run'
  }

  isDone() {
    return this.state === 'done'
  }

  isFail() {
    return this.state === 'fail'
  }

  isWarn() {
    return this.state === 'warn'
  }

  isEnd() {
    return this.state === 'end'
  }
}
