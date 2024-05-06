/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { generateSummary } = require('./summary')
const core = require('@actions/core')
const os = require('os')
const messages = require('./messages')
const { getGraceful } = require('./input')
const { isDocker } = require('./docker')

const graceful = getGraceful()
let boltFailedFlag = false
let isPostFlag = false

function setFailedFlagInState() {
  boltFailedFlag = true
  core.saveState('boltFailed', 'true')
}

function getFailedFlagFromState() {
  const boltFailed = core.getState('boltFailed')
  if (boltFailed) {
    return boltFailed === 'true'
  }
  return boltFailedFlag
}

function setPostFlagInState() {
  isPostFlag = true
  core.saveState('isPost', 'true')
}

function getPostFlagFromState() {
  const isPost = core.getState('isPost')
  if (isPost) {
    return isPost === 'true'
  }
  return isPostFlag
}

function checkDocker() {
  if (isDocker()) {
    setFailedFlagInState()
    if (graceful) {
      core.error(messages.UNSUPPORTED_DOCKER_ENVIRONMENT_MESSAGE)
    } else {
      core.setFailed(messages.UNSUPPORTED_DOCKER_ENVIRONMENT_FAILURE_MESSAGE)
    }
  }
}

function checkSelfHostedRunner() {
  const runnerName = process.env.RUNNER_NAME
  if (runnerName && !runnerName.startsWith('GitHub Actions')) {
    setFailedFlagInState()
    if (graceful) {
      core.error(messages.UNSUPPORTED_SELF_HOSTED_RUNNER_MESSAGE)
    } else {
      core.setFailed(messages.UNSUPPORTED_SELF_HOSTED_RUNNER_FAILURE_MESSAGE)
    }
  }
}

function checkPlatform(platform) {
  // Possible Platforms
  // 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'android' | 'cygwin' | 'sunos'
  const supportedPlatforms = ['linux']
  if (supportedPlatforms.indexOf(platform) === -1) {
    setFailedFlagInState()
    if (graceful) {
      core.error(messages.UNSUPPORTED_PLATFORM_MESSAGE(platform))
    } else {
      core.setFailed(messages.UNSUPPORTED_PLATFORM_FAILURE_MESSAGE(platform))
    }
  }
}

function checkArch(arch) {
  // Possible Archs
  // 'x64' | 'arm' | 'arm64' | 'ia32' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x'
  const supportedArch = ['x64', 'arm64', 'arm']
  if (supportedArch.indexOf(arch) === -1) {
    setFailedFlagInState()
    if (graceful) {
      core.error(messages.UNSUPPORTED_ARCH_MESSAGE(arch))
    } else {
      core.setFailed(messages.UNSUPPORTED_ARCH_FAILURE_MESSAGE(arch))
    }
  }
}

function init(platform, arch) {
  if (!platform || !arch) {
    return
  }

  if (getPostFlagFromState()) {
    if (getFailedFlagFromState()) {
      core.info('Skipping post action as bolt failed')
      return
    }

    generateSummary()
    return
  } else {
    setPostFlagInState()

    checkDocker()
    if (getFailedFlagFromState()) {
      return
    }

    checkSelfHostedRunner()
    if (getFailedFlagFromState()) {
      return
    }

    checkPlatform(platform)
    if (getFailedFlagFromState()) {
      return
    }

    checkArch(arch)
    if (getFailedFlagFromState()) {
      return
    }

    run()
  }
}

const platform = os.platform()
const arch = os.arch()
init(platform, arch)

module.exports = {
  init
}
