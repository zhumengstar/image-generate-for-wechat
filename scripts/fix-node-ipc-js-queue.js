const fs = require('fs')
const path = require('path')

const queueDir = path.join(__dirname, '..', 'node_modules', '@node-ipc', 'js-queue')
const expected = path.join(queueDir, 'queue.js')
const fallback = path.join(queueDir, 'queue-vanilla.js')

if (fs.existsSync(queueDir) && !fs.existsSync(expected) && fs.existsSync(fallback)) {
  fs.copyFileSync(fallback, expected)
  console.log('Patched @node-ipc/js-queue missing queue.js')
}

const pubsubDir = path.join(__dirname, '..', 'node_modules', 'event-pubsub')
const pubsubMain = path.join(pubsubDir, 'event-pubsub.js')

if (fs.existsSync(pubsubDir) && !fs.existsSync(pubsubMain)) {
  fs.writeFileSync(pubsubMain, [
    "const EventEmitter = require('events')",
    '',
    'class EventPubSub extends EventEmitter {',
    '  constructor() {',
    '    super()',
    '    this.setMaxListeners(0)',
    '  }',
    '}',
    '',
    'module.exports = EventPubSub',
    ''
  ].join('\n'))
  console.log('Patched event-pubsub missing event-pubsub.js')
}
