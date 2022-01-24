const MESSAGES = {
  noConfig: () => 'Create Nano Staged config.',
  noFileConfig: (file) => `Nano Staged config file *${file}* is not found.`,
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
