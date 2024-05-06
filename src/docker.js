/*
    Source: https://github.com/sindresorhus/is-docker/blob/main/index.js
    License: MIT
    Moved to src/docker.js due to jest import error
*/
const fs = require('fs')

let isDockerCached

function hasDockerEnv() {
  try {
    fs.statSync('/.dockerenv')
    return true
  } catch {
    return false
  }
}

function hasDockerCGroup() {
  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker')
  } catch {
    return false
  }
}

function isDocker() {
  // TODO: Use `??=` when targeting Node.js 16.
  if (isDockerCached === undefined) {
    isDockerCached = hasDockerEnv() || hasDockerCGroup()
  }

  return isDockerCached
}

module.exports = {
  isDocker
}
