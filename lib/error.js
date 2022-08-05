export class NanoStagedError extends Error {
  constructor(event) {
    super(event.reason)
    this.event = event
  }
}
