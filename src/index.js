/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { summary } = require('./summary').default
const core = require('@actions/core')

const isPost = core.getState('isPost')
const flag = isPost === 'true'

if (flag) {
  // Post
  summary()
} else {
  if (!isPost) {
    core.saveState('isPost', 'true')
  }
  run()
}
