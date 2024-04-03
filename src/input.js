const core = require('@actions/core')
const YAML = require('yaml')

function getGraceful() {
  const gracefulInput = `${core.getInput('graceful')}`.toLowerCase()
  if (gracefulInput === 'true') {
    return true
  }
  if (gracefulInput === 'false') {
    return false
  }
  core.warning(
    `⚠️ Invalid graceful flag value: ${gracefulInput}. Defaulting to true`
  )
  return true
}

function getMode() {
  const modeInput = `${core.getInput('mode')}`.toLowerCase()
  if (modeInput === 'audit') {
    return 'audit'
  }
  if (modeInput === 'active') {
    return 'active'
  }
  core.warning(`⚠️ Invalid mode value: ${modeInput}. Defaulting to audit`)
  return 'audit'
}

function getAllowHTTP() {
  const allowHTTPInput = `${core.getInput('allow_http')}`.toLowerCase()
  if (allowHTTPInput === 'true') {
    return true
  }
  if (allowHTTPInput === 'false') {
    return false
  }
  core.warning(
    `⚠️ Invalid allow_http value: ${allowHTTPInput}. Defaulting to false`
  )
  return false
}

function getDefaultPolicy() {
  const defaultPolicyInput = `${core.getInput('default_policy')}`.toLowerCase()
  if (defaultPolicyInput === 'allow-all') {
    return 'allow-all'
  }
  if (defaultPolicyInput === 'block-all') {
    return 'block-all'
  }
  core.warning(
    `⚠️ Invalid default_policy value: ${defaultPolicyInput}. Defaulting to block-all`
  )
  return 'block-all'
}

function getEgressRules() {
  const egressRulesYAML = core.getInput('egress_rules')
  try {
    const egressRules = YAML.parse(egressRulesYAML)
    egressRules.filter(rule => {
      const ruleJSON = JSON.stringify(rule)
      if (!rule.name || !rule.destination || !rule.action) {
        core.warning(`⚠️ Invalid egress rule: ${ruleJSON}.`)
        core.warning(`⏭️ Skipping this egress rule`)
        core.warning(
          `ℹ️ Every egress rule should have keys: ['name', 'destination', 'action']`
        )
        return false
      }
      return true
    })
    egressRules.map(rule => {
      const ruleJSON = JSON.stringify(rule)
      let ruleAction = rule.action?.toLowerCase()
      if (ruleAction !== 'allow' && ruleAction !== 'block') {
        core.warning(
          `⚠️ Invalid action: ${rule.action} in egress rule: ${ruleJSON}.`
        )
        core.warning(`⏭️ Skipping this egress rule`)
        core.warning(
          `ℹ️ Every egress rule should have action as 'allow' or 'block'`
        )
        ruleAction = 'allow'
      }
      let ruleDestination = rule.destination?.toLowerCase()
      if (
        ruleDestination.startsWith('http://') ||
        ruleDestination.startsWith('https://')
      ) {
        core.warning(`ℹ️ Removing http(s):// from destination`)
        ruleDestination = ruleDestination.replace(/^https?:\/\//, '')
      }
      if (ruleDestination.includes('/')) {
        core.warning(`ℹ️ Removing path from destination`)
        ruleDestination = ruleDestination.split('/')[0]
      }
      return {
        name: rule.name,
        destination: ruleDestination,
        action: ruleAction
      }
    })
    return egressRules
  } catch (error) {
    core.error(`Invalid YAML in egress_rules input: ${error.message}`)
    core.warning(`⏭️ Skipping all the egress rules`)
    return []
  }
}

function getTrustedGithubAccounts() {
  const trustedGithubAccountsYAML = core.getInput('trusted_github_accounts')
  try {
    const trustedGithubAccounts = YAML.parse(trustedGithubAccountsYAML)
    if (!Array.isArray(trustedGithubAccounts)) {
      core.warning(
        `⚠️ Invalid trusted_github_accounts value: ${trustedGithubAccounts}.`
      )
      core.warning(
        `ℹ️ trusted_github_accounts should be a list of github usernames`
      )
      core.warning(`ℹ️ Using enpty list as trusted_github_accounts`)
      return []
    }
    return trustedGithubAccounts
  } catch (error) {
    core.error(
      `Invalid YAML in trusted_github_accounts input: ${error.message}`
    )
    core.warning(
      `ℹ️ trusted_github_accounts should be a list of github usernames`
    )
    core.warning(`ℹ️ Using enpty list as trusted_github_accounts`)
    return []
  }
}

module.exports = {
  getGraceful,
  getMode,
  getAllowHTTP,
  getDefaultPolicy,
  getEgressRules,
  getTrustedGithubAccounts
}
