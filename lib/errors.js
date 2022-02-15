const MESSAGES = {
  noConfig: () => 'Create Nano Staged config.',
  noFileConfig: (path) => `Nano Staged config file *${path}* is not found.`,
  invalidConfig: () => 'Nano Staged config invalid.',
  noGitRepo: () => 'Nano Staged didn’t find git directory.',
  noFiles: (type) => `No ${type} files found.`,
  noMatchingFiles: () => 'No files match any configured task.',
}

export class NanoStagedError extends Error {
  constructor(type, ...args) {
    super(MESSAGES[type](...args))
    this.name = 'NanoStagedError'
    this.type = type
  }
}

export class TaskRunnerError extends Error {
  constructor(errors) {
    super(errors)
    this.name = 'TaskRunnerError'
  }
}
