/**
 * The entrypoint for the action.
 */
const { run } = require('./main')
const { summary } = require('./summary')
const core = require('@actions/core')

if (!!core.getState('isPost') === true) {
  run()
}
// Post
else {
  summary()
}
