const core = require('@actions/core')
const { DefaultArtifactClient } = require('@actions/artifact')
const { exec } = require('@actions/exec')
const { getAuditSummary } = require('./audit_summary')
const fs = require('fs')
const YAML = require('yaml')
const {
  getMode,
  getAllowHTTP,
  getDefaultPolicy,
  getEgressRules,
  getTrustedGithubAccounts
} = require('./input')
const {
  generateTestResults,
  getUniqueBy,
  getRawCollapsible
} = require('./summary_utils')

const mode = getMode()
const allowHTTP = getAllowHTTP()
const defaultPolicy = getDefaultPolicy()
const egressRules = getEgressRules()
const trustedGithubAccounts = getTrustedGithubAccounts()

function actionString(action) {
  switch (action) {
    case 'block':
      if (mode === 'active') {
        return '❌ Blocked'
      }
      return '❗❗ Will be blocked in Active mode'
    case 'allow':
      return '✅'
    default:
      return '❔'
  }
}

function resultToRow(result) {
  return [
    result.destination,
    result.scheme,
    result.rule_name,
    actionString(result.action)
  ]
}

async function generateSummary() {
  const isDebugMode = process.env.DEBUG === 'true' ? 'true' : 'false'
  const outputFile = core.getState('outputFile')
  const homeDir = core.getState('homeDir')
  const boltUser = core.getState('boltUser')

  const egressRulesYAML = YAML.stringify(egressRules)

  const artifactClient = new DefaultArtifactClient()

  const jobName = process.env.GITHUB_JOB // e.g. build

  if (isDebugMode === 'true') {
    // Upload auditd log file to artifacts
    const artifactName = `${jobName}-bolt-auditd-log`
    const files = ['/var/log/audit/audit.log']

    const { id, size } = await artifactClient.uploadArtifact(
      artifactName,
      files,
      '/var/log/audit'
    )
    core.info(`Created bolt auditd log artifact with id: ${id} (bytes: ${size}`)
  }

  await exec(
    `${homeDir}/auparse -format=json -i -out audit.json -in /var/log/audit/audit.log `
  )

  await artifactClient.uploadArtifact(
    `${jobName}-bolt-audit-json`,
    ['audit.json'],
    process.cwd()
  )

  if (!outputFile || !boltUser || !homeDir) {
    core.info(`Invalid Bold run. Missing required state variables`)
    return
  }
  if (!fs.existsSync(`${homeDir}/${outputFile}`)) {
    core.info(`Bolt output file not found`)
    return
  }

  await exec(`cp ${homeDir}/${outputFile} ${outputFile}`)

  const results = await generateTestResults(outputFile)

  const uniqueResults = getUniqueBy(results, ['destination', 'scheme'])
  // const uniqueResultRows = uniqueResults.map(resultToRow)

  const githubAccountCalls = results.filter(result => {
    return result.trusted_github_account_flag !== undefined
  })

  const githubAccounts = githubAccountCalls.reduce((accounts, call) => {
    const path = call.request_path
    const method = call.request_method
    const name = call.github_account_name
    const trusted_flag = call.trusted_github_account_flag
    accounts[name] = accounts[name] || {}
    accounts[name]['name'] = name
    accounts[name]['trusted'] = trusted_flag
    const paths = accounts[name]['paths'] || []
    if (!paths.some(p => p.path === path)) {
      accounts[name]['paths'] = [...paths, { path, method }]
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
    ['Allow HTTP', `${allowHTTP}`],
    ['Default Policy', defaultPolicy]
  ]

  const knownDestinations = [
    [
      { data: 'Destination', header: true },
      { data: 'Scheme', header: true },
      { data: 'Rule', header: true },
      { data: 'Action', header: true }
    ],
    ...uniqueResults
      .filter(result => result.default || result.action === 'allow')
      .map(resultToRow)
  ]

  const unknownDestinations = [
    [
      { data: 'Destination', header: true },
      { data: 'Scheme', header: true },
      { data: 'Rule', header: true },
      { data: 'Action', header: true }
    ],
    ...uniqueResults
      .filter(result => result.default === false && result.action === 'block')
      .map(resultToRow)
  ]

  const trustedGithubAccountsData = [
    [{ data: 'Github Account', header: true }],
    ...trustedGithubAccounts.map(account => [account])
  ]

  core.info('Koalalab-inc-bolt-config>>>')
  core.info(JSON.stringify(configMap))
  core.info('<<<Koalalab-inc-bolt-config')
  try {
    core.info('Koalalab-inc-bolt-egress-config>>>')
    core.info(JSON.stringify(egressRules))
    core.info('<<<Koalalab-inc-bolt-egress-config')
  } catch (error) {
    core.info(`Invalid YAML: ${error.message}`)
  }
  core.info('Koalalab-inc-bolt-egress-traffic-report>>>')
  core.info(JSON.stringify(results))
  core.info('<<<Koalalab-inc-bolt-egress-traffic-report')

  const configHeaderString = core.summary
    .addHeading('🛠️ Bolt Configuration', 3)
    .stringify()
  core.summary.emptyBuffer()

  const configTableString = core.summary.addTable(configTable).stringify()
  core.summary.emptyBuffer()

  const trustedGithubAccountsHeaderString = core.summary
    .addHeading('🔒 Trusted Github Accounts', 4)
    .stringify()
  core.summary.emptyBuffer()

  const trustedGithubAccountsTableString = core.summary
    .addTable(trustedGithubAccountsData)
    .stringify()
  core.summary.emptyBuffer()

  const knownDestinationsHeaderString = core.summary
    .addHeading('✅ Known Destinations', 4)
    .stringify()
  core.summary.emptyBuffer()

  const knownDestinationsTableString = core.summary
    .addTable(knownDestinations)
    .stringify()
  core.summary.emptyBuffer()

  const unknownDestinationsHeaderString = core.summary
    .addHeading('🚨 Unknown Destinations', 4)
    .stringify()
  core.summary.emptyBuffer()

  const unknownDestinationsTableString = core.summary
    .addTable(unknownDestinations)
    .stringify()
  core.summary.emptyBuffer()

  const auditSummary = await getAuditSummary()

  const auditSummaryRaw = auditSummary.zeroState
    ? auditSummary.zeroState
    : getRawCollapsible(auditSummary)

  let summary = core.summary
    .addSeparator()
    .addEOL()
    .addHeading('⚡ Egress Report - powered by Bolt', 2)
    .addRaw(
      `
<details open>
  <summary>
${configHeaderString}
  </summary>
${configTableString}
</details>
    `
    )

  if (trustedGithubAccounts.length > 0) {
    summary = summary
      .addRaw(
        `
<details open>
  <summary>
    ${trustedGithubAccountsHeaderString}
  </summary>
  ${trustedGithubAccountsTableString}
</details>
      `
      )
      .addQuote('NOTE: The account in which workflow runs is always trusted.')
  }

  if (egressRules.length > 0) {
    summary = summary
      .addHeading('📝 Egress rules', 3)
      .addCodeBlock(egressRulesYAML, 'yaml')
  } else {
    summary = summary
      .addRaw(
        `
> [!NOTE]
> You have not configured egress rules. Only deault policy will be applied. See [documentation](https://github.com/koalalab-inc/bolt/blob/main/README.md#custom-egress-policy) for more information.
      `
      )
      .addEOL()
  }

  if (untrustedGithubAccounts.length > 0) {
    summary = summary.addHeading(
      '🚨 Requests to untrusted GitHub accounts found',
      3
    ).addRaw(`
> [!CAUTION]
> If you do not recognize these GitHub Accounts, you may want to investigate further. Add them to your trusted GitHub accounts if this is expected. See [Docs](https://github.com/koalalab-inc/bolt?tab=readme-ov-file#configure) for more information.
      `)

    for (const account of untrustedGithubAccounts) {
      summary = summary.addRaw(`
<details open>
  <summary>
    ${account.name}
  </summary>
  <ul>
    ${account.paths.map(({ method, path }) => `<li><b>[${method}]</b> ${path}</li>`).join('')}
  </ul>
</details>
        `)
    }
  }

  summary = summary.addRaw(auditSummaryRaw)

  summary = summary.addHeading('Egress Traffic', 3)

  if (mode === 'active') {
    summary = summary.addQuote(
      'NOTE: Running in Active mode. All unknown/unverified destinations will be blocked.'
    )
  }
  summary = summary.addQuote(
    'NOTE: Running in Audit mode. Unknown/unverified destinations will be blocked in Active mode.'
  )

  summary = summary
    .addRaw(
      `
<details open>
  <summary>
${unknownDestinationsHeaderString}
  </summary>
${unknownDestinationsTableString}
</details>
    `
    )
    .addRaw(
      `
<details>
  <summary>
${knownDestinationsHeaderString}
  </summary>
${knownDestinationsTableString}
</details>
    `
    )
    .addLink(
      'View detailed analysis of this run on Koalalab!',
      'https://www.koalalab.com'
    )
    .addSeparator()

  summary.write()
}

module.exports = { generateSummary }
