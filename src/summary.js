const core = require('@actions/core')
const { exec } = require('@actions/exec')
const fs = require('fs')
const YAML = require('yaml')

async function generateTestResults(boltUser) {
  const filePath = 'output.log'
  await exec(`sudo cp /home/${boltUser}/${filePath} output.log`)
  await exec(`sudo chown -R runner:docker ${filePath}`)

  try {
    // Read the entire file synchronously and split it into an array of lines
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const lines = fileContent.split('\n')

    // Initialize an empty array to store JSON objects
    const jsonArray = []

    // Iterate through each line and parse it as JSON
    for (const line of lines) {
      try {
        const jsonObject = JSON.parse(line)
        jsonArray.push(jsonObject)
      } catch (error) {
        console.error(`Error parsing JSON on line: ${line}`)
      }
    }

    return jsonArray
  } catch (error) {
    console.error(`Error reading file: ${error.message}`)
    return []
  }
}

function actionString(action) {
  switch (action) {
    case 'block':
      return 'Unknown Destination'
    case 'allow':
      return '✅'
    default:
      return '❔'
  }
}

function getUniqueBy(arr, keys) {
  const uniqueObj = arr.reduce((unique, o) => {
    const key = keys.map(k => o[k]).join('|')
    unique[key] = o
    return unique
  }, {})
  return Object.values(uniqueObj)
}

async function generateSummary() {
  const boltUser = core.getState('boltUser')
  const mode = core.getInput('mode')
  const allowHTTP = core.getInput('allow_http')
  const defaultPolicy = core.getInput('default_policy')
  const egressRulesYAML = core.getInput('egress_rules')
  // Verify that egress_rules_yaml is valid YAML
  try {
    YAML.parse(egressRulesYAML)
  } catch (error) {
    core.info(`Invalid YAML: ${error.message}`)
  }

  const results = await generateTestResults(boltUser)

  const uniqueResults = getUniqueBy(results, ['destination', 'scheme']).map(
    result => [
      result.destination,
      result.scheme,
      result.rule_name,
      actionString(result.action)
    ]
  )

  const githubAccountCalls = results.filter(result => {
    return result.trusted_github_account_flag !== undefined
  })

  const githubAccounts = githubAccountCalls.reduce((accounts, call) => {
    const path = call.destination.request_path
    const name = call.github_account_name
    const trusted_flag = call.trusted_github_account_flag
    accounts[name] = accounts[name] || {}
    accounts[name]['name'] = name
    accounts[name]['trusted'] = trusted_flag
    const paths = accounts[name]['paths'] || []
    if (!paths.includes(path)) {
      accounts[name]['paths'] = [...paths, path]
    }
    return accounts
  }, [])

  const untrustedGithubAccounts = Object.values(githubAccounts).filter(
    account => {
      return account['trusted'] === false
    }
  )

  const configMap = {
    mode,
    allowHTTP,
    defaultPolicy
  }

  const configTable = [
    ['Mode', mode],
    ['Allow HTTP', allowHTTP],
    ['Default Policy', defaultPolicy]
  ]

  const table = [
    [
      { data: 'Destination', header: true },
      { data: 'Scheme', header: true },
      { data: 'Rule', header: true },
      { data: 'Action', header: true }
    ],
    ...uniqueResults
  ]

  core.info('Koalalab-inc-bolt-config>>>')
  core.info(JSON.stringify(configMap))
  core.info('<<<Koalalab-inc-bolt-config')
  try {
    const egressRules = YAML.parse(egressRulesYAML)
    core.info('Koalalab-inc-bolt-egress-config>>>')
    core.info(JSON.stringify(egressRules))
    core.info('<<<Koalalab-inc-bolt-egress-config')
  } catch (error) {
    core.info(`Invalid YAML: ${error.message}`)
  }
  core.info('Koalalab-inc-bolt-egress-traffic-report>>>')
  core.info(JSON.stringify(results))
  core.info('<<<Koalalab-inc-bolt-egress-traffic-report')

  let summary = core.summary
    .addHeading('Egress Report - powered by Bolt', 2)
    .addHeading('Bolt Configuration', 3)
    .addTable(configTable)
    .addHeading('Egress rules', 3)
    .addCodeBlock(egressRulesYAML, 'yaml')

  if (untrustedGithubAccounts.length > 0) {
    summary = summary.addHeading('Untrusted Github Accounts Found', 3).addRaw(`
> [!CAUTION]
> If you are not expecting these accounts to be making requests, you may want to investigate further. To avoid getting reports about these accounts, you can add them to the trusted_github_accounts.
      `)

    for (const account of untrustedGithubAccounts) {
      summary = summary.addRaw(`
<details open>
  <summary>
    ${account.name}
  </summary>
  <p>Paths:</p>
  <ul>
    ${account.paths.map(path => `<li>${path}</li>`).join('')}
  </ul>
</details>
        `)
    }
  }

  summary = summary
    .addHeading('Egress Traffic', 3)
    .addQuote(
      'Note:: Running in Audit mode. Unknown/unverified destinations will be blocked in Active mode.'
    )
    .addTable(table)
    .addLink(
      'View detailed analysis of this run on Koalalab!',
      'https://www.koalalab.com'
    )

  summary.write()
}

module.exports = { generateSummary }
