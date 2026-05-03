'use strict'

const path = require('path')

function resolve(dir) {
  return path.join(__dirname, dir)
}

// This project now runs as uni-app. Keep this file minimal because HBuilderX
// also reads vue.config.js during mini-program builds.
module.exports = {
  transpileDependencies: [],
  configureWebpack: {
    resolve: {
      alias: {
        '@': resolve('.')
      }
    }
  }
}
