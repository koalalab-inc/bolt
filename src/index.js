/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { generateSummary } = require('./summary')
const core = require('@actions/core')
const github = require('@actions/github')
const os = require('os')
const { releaseVersion } = require('./version')
const isDocker = require('is-docker')
const messages = require('./messages')
const { getGraceful } = require('./input')

const graceful = getGraceful()

function setFailedFlagInState() {
  core.saveState('boltFailed', 'true')
}

function getFailedFlagFromState() {
  const boltFailed = core.getState('boltFailed')
  return boltFailed === 'true'
}

function setPostFlagInState() {
  core.saveState('isPost', 'true')
}

function getPostFlagFromState() {
  const isPost = core.getState('isPost')
  return isPost === 'true'
}

function checkDocker() {
  if (isDocker()) {
    setFailedFlagInState()
    if (graceful) {
      core.error(
        messages.UNSUPPORTED_DOCKER_ENVIRONMENT_GRACEFUL_FAILURE_MESSAGE
      )
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
    core.saveState('boltFailed', 'true')
    if (graceful) {
      core.error(messages.UNSUPPORTED_ARCH_MESSAGE(arch))
    } else {
      core.setFailed(messages.UNSUPPORTED_ARCH_FAILURE_MESSAGE(arch))
    }
  }
}

function init(platform, arch) {
  if (getPostFlagFromState()) {
    if (getFailedFlagFromState()) {
      core.info('Skipping post action as bolt failed')
      return
    }

    generateSummary()
    return
  }

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

const platform = os.platform()
const arch = os.arch()
init(platform, arch)

module.exports = {
  init
}
