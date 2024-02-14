const core = require('@actions/core')
const { exec } = require('@actions/exec')
const fs = require('fs')


async function generateTestResults() {
    // Specify the path to your file
    exec('sudo cp /home/mitmproxyuser/output.log output.log')
    exec('sudo chown -R $USER:$USER output.log')
    const filePath = 'output.log'

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
    }
}

function actionIcon(action) {
    switch (action) {
        case 'block':
            return '❌'
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
    await exec('sudo systemctl status bolt')
    await exec('cat /home/mitmproxyuser/bolt.log')
    await exec('cat /home/mitmproxyuser/bolt-error.log')
    await exec('sudo systemctl status bolt')
    const results = await generateTestResults()
    const uniqueResults = getUniqueBy(results, ['domain', 'scheme']).map(
    result => [
        result.domain,
        result.scheme,
        result.rule_name,
        actionIcon(result.action)
    ]
  )

  const table = [
    [
      { data: 'Domain', header: true },
      { data: 'Scheme', header: true },
      { data: 'Rule', header: true },
      { data: 'Action', header: true }
    ],
    ...uniqueResults
  ]

  console.log('Koalalab-inc-egress-traffic-report>>>>>>>>>>')
  console.log(JSON.stringify(results))
  console.log('<<<<<<<<<<Koalalab-inc-egress-traffic-report')

  core.summary
    .addHeading('Egress Traffic Report')
    .addTable(table)
    .addLink(
      'View detailed analysis of this run on Koalalab!',
      'https://github.com'
    )
    .write()
}

module.exports = { summary }
