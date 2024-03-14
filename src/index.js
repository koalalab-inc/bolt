/**
 * The entrypoint for the action.
 */
const { all } = require('bluebird')
const { run } = require('./main')
const { summary } = require('./summary')
const core = require('@actions/core')

const isPost = core.getState('isPost')
const flag = isPost === 'true'
const boltFailed = core.getState('boltFailed')
const failedFlag = boltFailed === 'true'

function init() {
  if (flag) {
    if (failedFlag) {
      core.setFailed('Skipping post action as bolt failed')
      return
    }
    // Post
    summary()
  } else {
    if (!isPost) {
      core.saveState('isPost', 'true')
    }

    const { platform } = core
    if (platform.isWindows) {
      core.saveState('boltFailed', 'true')
      core.setFailed('This action is not supported on Windows')
      return
    }
    // Possible Archs
    // 'x64' | 'arm' | 'arm64' | 'ia32' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x'
    const allowedArch = ['x64', 'arm64', 'arm']
    const arch = platform.arch
    if (allowedArch.indexOf(arch) === -1) {
      core.saveState('boltFailed', 'true')
      core.setFailed(`This action is not supported on ${arch}`)
      return
    }

    run()
  }
}

init()
