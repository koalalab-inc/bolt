/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { summary } = require('./summary')
const core = require('@actions/core')

const flag = !!core.getState('isPost')

core.info(`isPost: ${core.getState('isPost')}`)

if (flag) {
  // Post
  summary()
} else {
  run()
}
