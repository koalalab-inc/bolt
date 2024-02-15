const core = require('@actions/core')
const { exec, getExecOutput } = require('@actions/exec')
const cache = require('@actions/cache');
const { wait } = require('./wait')
const { createInterceptDotPy } = require('./intercept')
const { boltService } = require('./bolt_service')
const YAML = require('yaml')
const fs = require('fs')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    core.startGroup('create-bolt-user')
    core.info('Creating bolt user...')
    const boltUser = 'bolt'
    core.saveState('boltUser', boltUser)
    await exec(`sudo useradd --create-home ${boltUser}`)
    core.info('Creating bolt user... done')
    core.endGroup('create-bolt-user')

    
    core.startGroup('setup-bolt')
    
    core.info("Reading inputs...")
    const mode = core.getInput('mode')
    const allow_http = core.getInput('allow_http')
    const default_policy = core.getInput('default_policy')
    const egress_rules_yaml = core.getInput('egress_rules')
    //Verify that egress_rules_yaml is valid YAML
    YAML.parse(egress_rules_yaml)
    core.info("Reading inputs... done")
    
    core.info('Installing mitmproxy...')
    // const { exitCode, stdout, stderr } = await getExecOutput(`sudo -u ${boltUser} pip cache dir`,[], {silent: true})
    // const pidDir = exitCode === 0 ? stdout.trim() : undefined
    // if (exitCode !== 0) {
    //   throw new Error(`Failed to get pid cache dir: ${stderr}`)
    // }

    const mitmPackageName = 'mitmproxy'
    const mitmPackageVersion = '10.2.2'
    const extractDir = "~/bolt"
    const cacheKey = `${mitmPackageName}-${mitmPackageVersion}-${pidDir}`
    const returnedKey = await cache.restoreCache([extractDir], cacheKey)
    if (returnedKey === cacheKey) {
      core.info(`Cache hit: ${cacheKey}`)
    } else {
      core.info(`Cache miss: ${cacheKey}`)
      // await exec(`sudo -u ${boltUser} -H bash -c "pip install --user ${mitmPackageName}==${mitmPackageVersion} --quiet"`)
      const filename = `${mitmPackageName}-${mitmPackageVersion}-linux.tar.gz`
      await exec(`wget https://downloads.mitmproxy.org/${mitmPackageVersion}/${filename}`)
      await exec(`mkdir -p ${extractDir}`)
      await exec(`tar -xzf ${filename} -C ${extractDir}`)
      await exec(`rm ${extractDir}/mitmproxy ${extractDir}/mitmweb`)
      await cache.saveCache([pidDir], cacheKey)
    }
    await exec(`sudo cp ${extractDir}/mitmdump /home/${boltUser}/`)
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}/mitmdump`)
    core.info('Installing mitmproxy... done')

    core.info('Create bolt output file...')
    await exec(`sudo -u ${boltUser} -H bash -c "touch /home/${boltUser}/output.log`)
    core.info('Create bolt output file... done')

    core.info('Create bolt config...')
    const boltConfig = `dump_destination: "/home/${boltUser}/output.log"`
    fs.writeFileSync('config.yaml', boltConfig)
    await exec(`sudo -u ${boltUser} -H bash -c "mkdir -p /home/${boltUser}/.mitmproxy"`)
    await exec(`sudo cp config.yaml /home/${boltUser}/.mitmproxy/`) 
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}/.mitmproxy/config.yaml`)
    core.info('Create bolt config... done')

    core.info('Create bolt egress_rules.yaml...')
    fs.writeFileSync('egress_rules.yaml', egress_rules_yaml)
    await exec(`sudo cp egress_rules.yaml /home/${boltUser}/`)
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}/egress_rules.yaml`)
    core.info('Create bolt egress_rules.yaml... done')

    core.info('Create intercept module...')
    await createInterceptDotPy(boltUser)
    await exec(`sudo cp intercept.py /home/${boltUser}/`)
    await exec(`sudo chown ${boltUser}:${boltUser} /home/${boltUser}/intercept.py`)
    core.info('Create intercept done...')
    
    core.info('Create bolt service log files...')
    const logFile = `/home/${boltUser}/bolt.log`;
    const errorLogFile = `/home/${boltUser}/bolt-error.log`;
    await exec(`sudo touch ${logFile}`)
    await exec(`sudo touch ${errorLogFile}`)
    await exec(`sudo chown ${boltUser}:${boltUser} ${logFile} ${errorLogFile}`)
    core.info('Create bolt service log files... done')

    core.info('Create bolt service...')
    const boltServiceConfig = await boltService(boltUser, mode, allow_http, default_policy, logFile, errorLogFile)
    fs.writeFileSync('bolt.service', boltServiceConfig)
    await exec('sudo cp bolt.service /etc/systemd/system/')
    await exec('sudo chown root:root /etc/systemd/system/bolt.service')
    await exec('sudo systemctl daemon-reload')
    core.info('Create bolt service... done')
    
    core.endGroup('setup-bolt')
    
    core.startGroup('run-bolt')
    core.info('Starting bolt...')
    await exec('sudo systemctl start bolt')

    core.info('Waiting for bolt to start...')
    const ms = 5000
    core.info(`Waiting ${ms} milliseconds ...`)
    await wait(ms)
    await exec('sudo systemctl status bolt')
    core.info('Starting bolt... done')

    core.endGroup('run-bolt')


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
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
  }
}

module.exports = {
  run
}
