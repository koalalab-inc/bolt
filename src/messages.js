const { releaseVersion } = require('./version')

const UNSUPPORTED_DOCKER_ENVIRONMENT_MESSAGE = `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported in Docker environment.
⏭️ Skipping this step as Bolt is configured to fail gracefully in unsupported environments.
🛠️ To change this behavior, set graceful flag to false. It is true by default
`

const UNSUPPORTED_DOCKER_ENVIRONMENT_FAILURE_MESSAGE = `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported in Docker environment.`

const UNSUPPORTED_SELF_HOSTED_RUNNER_MESSAGE = `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on self-hosted runners.
⏭️ Skipping this step as Bolt is configured to fail gracefully on unsupported platforms.
🛠️ To change this behavior, set graceful flag to false. It is true by default`

const UNSUPPORTED_SELF_HOSTED_RUNNER_FAILURE_MESSAGE = `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on self-hosted runners`

const UNSUPPORTED_PLATFORM_MESSAGE = platform =>
  `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on ${platform}.
⏭️ Skipping this step as Bolt is configured to fail gracefully on unsupported platforms.
🛠️ To change this behavior, set graceful flag to false. It is true by default`

const UNSUPPORTED_PLATFORM_FAILURE_MESSAGE = platform =>
  `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on ${platform}`

const UNSUPPORTED_ARCH_MESSAGE = arch =>
  `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on ${arch}.
⏭️ Skipping this step as Bolt is configured to fail gracefully on unsupported platforms.
🛠️ To change this behavior, set graceful flag to false. It is true by default`

const UNSUPPORTED_ARCH_FAILURE_MESSAGE = arch =>
  `❌ OSS version of Koalalab-inc/bolt@${releaseVersion} is not supported on ${arch}`

module.exports = {
  UNSUPPORTED_DOCKER_ENVIRONMENT_MESSAGE,
  UNSUPPORTED_DOCKER_ENVIRONMENT_FAILURE_MESSAGE,
  UNSUPPORTED_SELF_HOSTED_RUNNER_MESSAGE,
  UNSUPPORTED_SELF_HOSTED_RUNNER_FAILURE_MESSAGE,
  UNSUPPORTED_PLATFORM_MESSAGE,
  UNSUPPORTED_PLATFORM_FAILURE_MESSAGE,
  UNSUPPORTED_ARCH_MESSAGE,
  UNSUPPORTED_ARCH_FAILURE_MESSAGE
}
