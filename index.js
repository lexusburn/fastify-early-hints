'use strict'

const fp = require('fastify-plugin')
const formatEntry = require('./lib/formatEntry')
const CRLF = '\r\n'
const EarlyHints = `HTTP/1.1 103 Early Hints${CRLF}`

function fastifyEarlyHints (fastify, opts, next) {
  const formatEntryOpts = {
    warn: opts.warn
  }

  function writeEarlyHints (headers) {
    const reply = this

    if (reply.sent) return Promise.resolve()
  
    if (typeof reply.raw.writeEarlyHints === 'function') {
      reply.raw.writeEarlyHints(headers)
      return Promise.resolve()
    }
  
    // HTTP/1 fallback
    let message = ''
    if (Array.isArray(headers)) {
      for (const nameValues of headers) {
        if (typeof nameValues === 'object' &&
            typeof nameValues.name === 'string' &&
            typeof nameValues.value === 'string') {
          message += `${nameValues.name}: ${nameValues.value}${CRLF}`
        } else {
          return Promise.reject(Error('"headers" expected to be name-value object'))
        }
      }
    } else if (typeof headers === 'object' && headers !== null) {
      for (const key of Object.keys(headers)) {
        if (Array.isArray(headers[key])) {
          for (const value of headers[key]) {
            message += `${key}: ${value}${CRLF}`
          }
        } else {
          message += `${key}: ${headers[key]}${CRLF}`
        }
      }
    } else {
      return Promise.reject(Error(`"headers" expected to be object or Array, but received ${typeof headers}`))
    }
  
    if (reply.raw.socket) {
      reply.raw.socket.write(`${EarlyHints}${message}${CRLF}`, 'ascii')
    }
  
    return Promise.resolve()
  }

  function writeEarlyHintsLinks (links) {
    const reply = this
  
    if (typeof reply.raw.writeEarlyHints === 'function') {
      reply.raw.writeEarlyHints({ link: links })
      return Promise.resolve()
    }
  
    let message = ''
    for (let i = 0; i < links.length; i++) {
      message += `${formatEntry(links[i], formatEntryOpts)}${CRLF}`
    }
  
    if (reply.raw.socket) {
      reply.raw.socket.write(`${EarlyHints}${message}${CRLF}`, 'ascii')
    }
  
    return Promise.resolve()
  }

  fastify.decorateReply('writeEarlyHints', writeEarlyHints)

  // we provide a handy method to write link header only
  fastify.decorateReply('writeEarlyHintsLinks', writeEarlyHintsLinks)

  fastify.decorateReply('earlyHints', function (payload) {
    if (!payload) return Promise.resolve()

    if (payload.link) {
      const links = Array.isArray(payload.link)
        ? payload.link
        : [payload.link]

      return this.writeEarlyHintsLinks(links)
    }

    return this.writeEarlyHints(payload)
  })

  next()
}

module.exports = fp(fastifyEarlyHints, {
  fastify: '5.x',
  name: '@fastify/early-hints'
})
module.exports.default = fastifyEarlyHints
module.exports.fastifyEarlyHints = fastifyEarlyHints
