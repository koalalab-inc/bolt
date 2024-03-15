const core = require('@actions/core')
const { exec } = require('@actions/exec')
const { wait } = require('./wait')
const { boltService } = require('./bolt_service')
const { boltSudoers } = require('./bolt_sudoers')
const YAML = require('yaml')
const fs = require('fs')
const os = require('os')

let startTime = Date.now()

function benchmark(featureName) {
  const endTime = Date.now()
  core.info(
    `Time Elapsed in ${featureName}: ${Math.ceil((endTime - startTime) / 1000)}s`
  )
  startTime = endTime
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    startTime = Date.now()
    core.info(`Start time: ${startTime}`)

    // Changing boltUser will require changes in bolt.service and intercept.py
    const boltUser = 'bolt'
    core.saveState('boltUser', boltUser)
    
    const platform = os.platform()
    
    core.startGroup('create-bolt-user')
    core.info('Creating bolt user...')
    const isLinux = platform === 'linux'
    const isMacOS = platform === 'darwin'
    const homeDir = isLinux ? `/home/${boltUser}` : `/Users/${boltUser}`
    const boltGroup = isLinux ? 'bolt' : 'staff'
    if (isLinux) {
      await exec(`sudo useradd ${boltUser}`)
      await exec(`sudo mkdir -p ${homeDir}`)
      await exec(`sudo chown ${boltUser}:${boltGroup} ${homeDir}`)
    } else if (isMacOS) {
      await exec(`sudo sysadminctl -addUser ${boltUser}`)
      const boltSudoersFileContent = await boltSudoers(boltUser);
      fs.writeFileSync('bolt-sudoers', boltSudoersFileContent)
      await exec(`sudo chown root:wheel bolt-sudoers`)
      await exec(`sudo mv bolt-sudoeers-conf /etc/sudoers.d/${boltUser}`)
    }

    core.info('Creating bolt user... done')
    core.endGroup('create-bolt-user')

    benchmark('create-bolt-user')

    core.startGroup('download-executable')
    const releaseName = 'bolt'
    // const extractDir = 'home/runner/bolt'
    // await exec(`mkdir -p ${extractDir}`)
    core.info('Downloading mitmproxy...')
    const releaseVersion = 'v1.2.0-rc'
    const platformOS = isLinux ? 'linux' : 'macos'
    const filename = `${releaseName}-${releaseVersion}-${platformOS}-x86_64.tar.gz`
    // Sample URL :: https://api-do-blr.koalalab.com/bolt/package/v0.7.0/bolt-v0.7.0-linux-x86_64.tar.gz
    // Sample Backup URL :: https://github.com/koalalab-inc/bolt/releases/download/v0.7.0/bolt-v0.7.0-linux-x86_64.tar.gz
    let referrer = ''
    try {
      const repoName = process.env.GITHUB_REPOSITORY; // e.g. koalalab-inc/bolt
      const workflowName = process.env.GITHUB_WORKFLOW.replace(/\//g, "|"); // e.g. CI
      const jobName = process.env.GITHUB_JOB; // e.g. build
      referrer = `github.com/${repoName}/${workflowName}/${jobName}`
    } catch (error) {
      core.info('Error getting referrer')
    }
    const primaryDownloadExitCode = await exec(
      `wget --quiet --header "Referrer: ${referrer}" https://api-do-blr.koalalab.com/bolt/package/${releaseVersion}/${filename}`
    )
    if (primaryDownloadExitCode !== 0) {
      core.info('Primary download failed, trying backup...')
      await exec(
        `wget --quiet https://github.com/koalalab-inc/bolt/releases/download/${releaseVersion}/${filename}`
      )
    }
    core.info('Downloading mitmproxy... done')
    await exec(`tar -xzf ${filename}`)
    if (isLinux) {
      await exec(`sudo cp bolt/mitmdump ${homeDir}`)
      await exec(`sudo chown ${boltUser}:${boltGroup} ${homeDir}/mitmdump`)
    } else if (isMacOS) {
      await exec(`sudo cp -R bolt/mitmproxy.app ${homeDir}`)
      await exec(`sudo chown -R ${boltUser}:${boltGroup} ${homeDir}/mitmdump.app`)
    }
    await exec(`sudo cp bolt/intercept.py ${homeDir}`)
    await exec(`sudo chown ${boltUser}:${boltGroup} ${homeDir}/intercept.py`)
    core.endGroup('download-executable')

    benchmark('download-executable')

    core.startGroup('setup-bolt')
    core.info('Reading inputs...')
    const mode = core.getInput('mode')
    const allowHTTP = core.getInput('allow_http')
    const defaultPolicy = core.getInput('default_policy')
    const egressRulesYAML = core.getInput('egress_rules')

    // Verify that egress_rules_yaml is valid YAML
    YAML.parse(egressRulesYAML)
    core.info('Reading inputs... done')

    core.info('Create bolt output file...')
    await exec(
      `sudo -u ${boltUser} -H bash -c "touch ${homeDir}/output.log`
    )
    core.info('Create bolt output file... done')

    core.info('Create bolt config...')
    const boltConfig = `dump_destination: "${homeDir}/output.log"`
    fs.writeFileSync('config.yaml', boltConfig)
    await exec(
      `sudo -u ${boltUser} -H bash -c "mkdir -p ${homeDir}/.mitmproxy`
    )
    await exec(
      `sudo cp config.yaml ${homeDir}/.mitmproxy/`
    )
    await exec(
      `sudo chown ${boltUser}:${boltGroup} ${homeDir}/.mitmproxy/config.yaml`
    )
    core.info('Create bolt config... done')

    core.info('Create bolt egress_rules.yaml...')
    fs.writeFileSync('egress_rules.yaml', egressRulesYAML)
    await exec(`sudo cp egress_rules.yaml ${homeDir}`)
    await exec(
      `sudo chown ${boltUser}:${boltGroup} ${homeDir}/egress_rules.yaml`
    )
    core.info('Create bolt egress_rules.yaml... done')

    core.info('Create bolt service log files...')
    const logFile = `${homeDir}/bolt.log`
    const errorLogFile = `${homeDir}/bolt-error.log`
    await exec(`sudo touch ${logFile}`)
    await exec(`sudo touch ${errorLogFile}`)
    await exec(`sudo chown ${boltUser}:${boltGroup} ${logFile} ${errorLogFile}`)
    core.info('Create bolt service log files... done')

    core.info('Create bolt service...')
    const boltServiceConfig = await boltService(
      boltUser,
      mode,
      allowHTTP,
      defaultPolicy,
      logFile,
      errorLogFile
    )
    fs.writeFileSync('bolt.service', boltServiceConfig)
    await exec('sudo cp bolt.service /etc/systemd/system/')
    await exec('sudo chown root:root /etc/systemd/system/bolt.service')
    await exec('sudo systemctl daemon-reload')
    core.info('Create bolt service... done')
    core.endGroup('setup-bolt')

    benchmark('configure-bolt')

    core.startGroup('run-bolt')
    core.info('Starting bolt...')
    await exec('sudo systemctl start bolt')
    core.info('Waiting for bolt to start...')
    const ms = 1000
    await wait(ms)
    await exec('sudo systemctl status bolt')
    core.info('Starting bolt... done')
    core.endGroup('run-bolt')

    benchmark('start-bolt')

    core.startGroup('setup-iptables-redirection')
    await exec('sudo sysctl -w net.ipv4.ip_forward=1')
    await exec('sudo sysctl -w net.ipv6.conf.all.forwarding=1')
    await exec('sudo sysctl -w net.ipv4.conf.all.send_redirects=0')
    await exec(
      `sudo iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner ${boltUser} --dport 80 -j REDIRECT --to-port 8080`
    )
    await exec(
      `sudo iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner ${boltUser} --dport 443 -j REDIRECT --to-port 8080`
    )
    await exec(
      `sudo ip6tables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner ${boltUser} --dport 80 -j REDIRECT --to-port 8080`
    )
    await exec(
      `sudo ip6tables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner ${boltUser} --dport 443 -j REDIRECT --to-port 8080`
    )
    core.endGroup('setup-iptables-redirection')

    benchmark('setup-iptables-redirection')
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.saveState('boltFailed', 'true')
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
