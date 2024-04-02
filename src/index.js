/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { generateSummary } = require('./summary')
const core = require('@actions/core')

const isPost = core.getState('isPost')
const flag = isPost === 'true'

if (flag) {
  // Post
  generateSummary()
} else {
  if (!isPost) {
    core.saveState('isPost', 'true')
  }
  run()
}
