/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { generateSummary } = require('./summary')
const core = require('@actions/core')
const os = require('os')
const { releaseVersion } = require('./version')

const isPost = core.getState('isPost')
const flag = isPost === 'true'
const boltFailed = core.getState('boltFailed')
const failedFlag = boltFailed === 'true'

function init(platform, arch) {
  if (flag) {
    if (failedFlag) {
      core.info('Skipping post action as bolt failed')
      return
    }
    // Post
    generateSummary()
  } else {
    if (!isPost) {
      core.saveState('isPost', 'true')
    }

    // 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'android' | 'cygwin' | 'sunos'
    if (['linux'].indexOf(platform) === -1) {
      core.saveState('boltFailed', 'true')
      core.setFailed(
        `Koalalab-inc/bolt@${releaseVersion} is not supported on ${platform}`
      )
      return
    }
    // Possible Archs
    // 'x64' | 'arm' | 'arm64' | 'ia32' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x'
    const allowedArch = ['x64', 'arm64', 'arm']
    if (allowedArch.indexOf(arch) === -1) {
      core.saveState('boltFailed', 'true')
      core.setFailed(
        `Koalalab-inc/bolt@${releaseVersion} is not supported on ${arch}`
      )
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
