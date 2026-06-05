// Browser-safe shim for @mistralai/mistralai HTTPClient
// The package's export maps don't expose the ESM path, so we provide a compatible class
class HTTPClient {
  constructor(options) {
    this.options = options || {}
    this._hooks = { beforeRequest: [] }
  }
  addHook(event, fn) {
    if (!this._hooks[event]) this._hooks[event] = []
    this._hooks[event].push(fn)
  }
  clone() { return new HTTPClient(this.options) }
}

module.exports = { HTTPClient }
