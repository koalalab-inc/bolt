const core = require('@actions/core')
const { exec } = require('@actions/exec')
const { wait } = require('./wait')
const { boltService } = require('./bolt_service')
const YAML = require('yaml')
const fs = require('fs')

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

    core.startGroup('create-bolt-user')
    core.info('Creating bolt user...')
    await exec(`sudo useradd ${boltUser}`)
    await exec(`sudo mkdir -p /home/${boltUser}`)
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}`)
    core.info('Creating bolt user... done')
    core.endGroup('create-bolt-user')

    benchmark('create-bolt-user')

    core.startGroup('download-executable')
    const releaseName = 'bolt'
    // const extractDir = 'home/runner/bolt'
    // await exec(`mkdir -p ${extractDir}`)
    core.info('Downloading mitmproxy...')
    const releaseVersion = 'v0.7.0'
    const filename = `${releaseName}-${releaseVersion}-linux-x86_64.tar.gz`
    // Sample URL :: https://github.com/koalalab-inc/bolt/releases/download/v0.7.0/bolt-v0.7.0-linux-x86_64.tar.gz
    await exec(
      `wget --quiet https://github.com/koalalab-inc/bolt/releases/download/${releaseVersion}/${filename}`
    )
    core.info('Downloading mitmproxy... done')
    await exec(`tar -xzf ${filename}`)
    await exec(`sudo cp bolt/mitmdump /home/${boltUser}/`)
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}/mitmdump`)
    await exec(`sudo cp bolt/intercept.py /home/${boltUser}/`)
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}/intercept.py`)
    core.endGroup('ddownload-executable')

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
      `sudo -u ${boltUser} -H bash -c "touch /home/${boltUser}/output.log`
    )
    core.info('Create bolt output file... done')

    core.info('Create bolt config...')
    const boltConfig = `dump_destination: "/home/${boltUser}/output.log"`
    fs.writeFileSync('config.yaml', boltConfig)
    await exec(
      `sudo -u ${boltUser} -H bash -c "mkdir -p /home/${boltUser}/.mitmproxy"`
    )
    await exec(`sudo cp config.yaml /home/${boltUser}/.mitmproxy/`)
    await exec(
      `sudo chown ${boltUser}:${boltUser} /home/${boltUser}/.mitmproxy/config.yaml`
    )
    core.info('Create bolt config... done')

    core.info('Create bolt egress_rules.yaml...')
    fs.writeFileSync('egress_rules.yaml', egressRulesYAML)
    await exec(`sudo cp egress_rules.yaml /home/${boltUser}/`)
    await exec(
      `sudo chown ${boltUser}:${boltUser} /home/${boltUser}/egress_rules.yaml`
    )
    core.info('Create bolt egress_rules.yaml... done')

    core.info('Create bolt service log files...')
    const logFile = `/home/${boltUser}/bolt.log`
    const errorLogFile = `/home/${boltUser}/bolt-error.log`
    await exec(`sudo touch ${logFile}`)
    await exec(`sudo touch ${errorLogFile}`)
    await exec(`sudo chown ${boltUser}:${boltUser} ${logFile} ${errorLogFile}`)
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
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
