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
      return 'Unknown Domain'
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

async function summary() {
  const boltUser = core.getState('boltUser')
  const mode = core.getInput('mode')
  const allow_http = core.getInput('allow_http')
  const default_policy = core.getInput('default_policy')
  const egress_rules_yaml = core.getInput('egress_rules')
  //Verify that egress_rules_yaml is valid YAML
  try {
    YAML.parse(egress_rules_yaml)
  } catch (error) {
    core.info(`Invalid YAML: ${error.message}`)
  }

  const results = await generateTestResults(boltUser)

  const uniqueResults = getUniqueBy(results, ['domain', 'scheme']).map(
    result => [
      result.domain,
      result.scheme,
      result.rule_name,
      actionString(result.action)
    ]
  )

  const configMap = {
    mode,
    allow_http,
    default_policy
  }

  const configTable = [
    ['Mode', mode],
    ['Allow HTTP', allow_http],
    ['Default Policy', default_policy]
  ]

  const table = [
    [
      { data: 'Domain', header: true },
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
    const egress_rules = YAML.parse(egress_rules_yaml)
    core.info('Koalalab-inc-bolt-egress-config>>>')
    core.info(JSON.stringify(egress_rules))
    core.info('<<<Koalalab-inc-bolt-egress-config')
  } catch (error) {
    core.info(`Invalid YAML: ${error.message}`)
  }
  core.info('Koalalab-inc-bolt-egress-traffic-report>>>')
  core.info(JSON.stringify(results))
  core.info('<<<Koalalab-inc-bolt-egress-traffic-report')

  core.summary
    .addHeading('Egress Report - powered by Bolt', 2)
    .addHeading('Bolt Configuration', 3)
    .addTable(configTable)
    .addHeading('Egress rules', 3)
    .addCodeBlock(egress_rules_yaml, 'yaml')
    .addHeading('Egress Traffic', 3)
    .addQuote(
      `Note:: Running in Audit mode. Unverified domains will be blocked in Active mode.`
    )
    .addTable(table)
    .addLink(
      'View detailed analysis of this run on Koalalab!',
      'https://www.koalalab.com'
    )
    .write()
}

module.exports = { summary }
