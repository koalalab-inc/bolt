/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { generateSummary } = require('./summary')
const core = require('@actions/core')
const github = require('@actions/github')
const os = require('os')
const { releaseVersion } = require('./version')

const isPost = core.getState('isPost')
const flag = isPost === 'true'
const boltFailed = core.getState('boltFailed')
const failedFlag = boltFailed === 'true'

const { getGraceful } = require('./input')

const graceful = getGraceful()

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

    const runnerName = process.env.RUNNER_NAME
    core.info(`Runner Name: ${runnerName}`)

    if (runnerName && !runnerName.startsWith('GitHub Actions')) {
      core.saveState('boltFailed', 'true')
      core.error(
        `
❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on self-hosted runners.
⏭️ Bolt will exit gracefully. Your workflow will continue to run. This workflow run won't be monitored by Bolt.
        `
      )
    }

    // 'win32' | 'darwin' | 'linux' | 'freebsd' | 'openbsd' | 'android' | 'cygwin' | 'sunos'
    if (['linux'].indexOf(platform) === -1) {
      core.saveState('boltFailed', 'true')
      if (graceful) {
        core.error(
          `
❌ Koalalab-inc/bolt@${releaseVersion} is not supported on ${platform}.
⏭️ Skipping this step as Bolt is configured to fail gracefully on unsupported platforms.
🛠️ To change this behavious, set graceful flag to false. It is true by default
          `
        )
      } else {
        core.setFailed(
          `Koalalab-inc/bolt@${releaseVersion} is not supported on ${platform}`
        )
      }
      return
    }
    // Possible Archs
    // 'x64' | 'arm' | 'arm64' | 'ia32' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 'riscv64' | 's390' | 's390x'
    const allowedArch = ['x64', 'arm64', 'arm']
    if (allowedArch.indexOf(arch) === -1) {
      core.saveState('boltFailed', 'true')
      if (graceful) {
        core.error(
          `
❌ Koalalab-inc/bolt@${releaseVersion} is not supported on ${arch}.
⏭️ Skipping this step as Bolt is configured to fail gracefully on unsupported platforms.
🛠️ To change this behavious, set graceful flag to false. It is true by default
          `
        )
      } else {
        core.setFailed(
          `Koalalab-inc/bolt@${releaseVersion} is not supported on ${arch}`
        )
      }
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
