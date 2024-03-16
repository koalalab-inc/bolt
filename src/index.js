/**
 * The entrypoint for the action.
 */
const { all } = require('bluebird')
const { run } = require('./main')
const { summary } = require('./summary')
const core = require('@actions/core')
const os = require('os')

const isPost = core.getState('isPost')
const flag = isPost === 'true'
const boltFailed = core.getState('boltFailed')
const failedFlag = boltFailed === 'true'

function init() {
  if (flag) {
    if (failedFlag) {
      core.info('Skipping post action as bolt failed')
      return
    }
    // Post
    summary()
  } else {
    if (!isPost) {
      core.saveState('isPost', 'true')
    }

    const platform = os.platform()
    // 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'android' | 'cygwin' | 'sunos'
    if (['darwin', 'linux'].indexOf(platform) === -1) {
      core.saveState('boltFailed', 'true')
      core.setFailed(`This action is not supported on ${platform}`)
      return
    }
    // Possible Archs
    // 'x64' | 'arm' | 'arm64' | 'ia32' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x'
    const allowedArch = ['x64', 'arm64', 'arm']
    const arch = os.arch()
    if (allowedArch.indexOf(arch) === -1) {
      core.saveState('boltFailed', 'true')
      core.setFailed(`This action is not supported on ${arch}`)
      return
    }

    run()
  }
}

init()
