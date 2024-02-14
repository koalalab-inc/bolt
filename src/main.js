const core = require('@actions/core')
const io = require('@actions/io')
const { exec } = require('@actions/exec')
const { wait } = require('./wait')
const { createInterceptDotPy } = require('./intercept')
var spawn = require('child_process').spawn;
const fs = require('fs')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    core.startGroup('setup')
    core.info('Creating mitmproxy user...')
    await exec('sudo useradd --create-home mitmproxyuser')
    core.info('Creating mitmproxy user... done')

    const mode = core.getInput('mode')
    const allow_http = core.getInput('allow_http')
    const default_policy = core.getInput('default_policy')
    const egress_rules_yaml = core.getInput('egress_rules')
    core.endGroup('setup')

    core.startGroup('install-mitmproxy')
    core.info('Installing mitmproxy...')
    await exec('sudo -u mitmproxyuser -H bash -c "cd ~ && pip install --user mitmproxy --quiet"')
    core.info('Installing mitmproxy... done')
    core.endGroup('install-mitmproxy')

    core.startGroup('run-bolt')

    core.info('Starting bolt...')
    const createBoltOutputFileCommand = 'sudo -u mitmproxyuser -H bash -c "touch /home/mitmproxyuser/output.log'
  
    await exec(createBoltOutputFileCommand)

    const mitmConfig = 'dump_destination: "/home/mitmproxyuser/output.log"'
    fs.writeFileSync('config.yaml', mitmConfig)
    fs.writeFileSync('egress_rules.yaml', core.getInput('egress_rules'))
    createInterceptDotPy()

    const createBoltConfigCommand = 'sudo -u mitmproxyuser -H bash -c "mkdir -p /home/mitmproxyuser/.mitmproxy"'
    await exec(createBoltConfigCommand)

    await exec('ls -lah')
    await exec('sudo ls  -lah')
    await exec('sudo ls  -lah /home/mitmproxyuser')
    await exec('sudo ls  -lah /home/mitmproxyuser/.mitmproxy')

    await exec('sudo cp config.yaml /home/mitmproxyuser/.mitmproxy/') 
    await exec('sudo chown mitmproxyuser:mitmproxyuser /home/mitmproxyuser/.mitmproxy/config.yaml')

    await exec('sudo cp intercept.py /home/mitmproxyuser/')
    await exec('sudo chown mitmproxyuser:mitmproxyuser /home/mitmproxyuser/intercept.py')

    await exec('sudo cp egress_rules.yaml /home/mitmproxyuser/')
    await exec('sudo chown mitmproxyuser:mitmproxyuser /home/mitmproxyuser/egress_rules.yaml')

    // const runBoltCommand = `sudo -u mitmproxyuser -H bash -c "BOLT_MODE=${mode} BOLT_ALLOW_HTTP=${ allow_http} BOLT_DEFAULT_POLICY=${default_policy} $HOME/.local/bin/mitmdump --mode transparent --showhost --set block_global=false -s /home/mitmproxyuser/intercept.py &"`

    const boltCommand = 'sudo';
    const boltArgs = [
      '-u', 'mitmproxyuser',
      '-H',
      'bash', '-c',
      `BOLT_MODE=${mode} BOLT_ALLOW_HTTP=${ allow_http} BOLT_DEFAULT_POLICY=${default_policy} $HOME/.local/bin/mitmdump --mode transparent --showhost --set block_global=false -s /home/mitmproxyuser/intercept.py &`
    ];
    // core.info(runBoltCommand)
    const cp = spawn(boltCommand, boltArgs, {detached: true});

    cp.stdout.on('data', (data) => {
      core.info(`stdout: ${data}`);
    });
    
    cp.stderr.on('data', (data) => {
      core.error(`stderr: ${data}`);
    });
    
    cp.on('close', (code) => {
      core.info(`child process exited with code ${code}`);
    }); 

    core.info('Waiting for bolt to start...')
    const ms = 5000
    core.info(`Waiting ${ms} milliseconds ...`)
    await wait(ms)
    core.info('Starting bolt... done')

    core.endGroup('run-bolt')

    core.startGroup('setup-iptables-redirection')
    await exec('sudo sysctl -w net.ipv4.ip_forward=1')
    await exec('sudo sysctl -w net.ipv6.conf.all.forwarding=1')
    await exec('sudo sysctl -w net.ipv4.conf.all.send_redirects=0')
    await exec(
      'sudo iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner mitmproxyuser --dport 80 -j REDIRECT --to-port 8080'
    )
    await exec(
      'sudo iptables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner mitmproxyuser --dport 443 -j REDIRECT --to-port 8080'
    )
    await exec(
      'sudo ip6tables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner mitmproxyuser --dport 80 -j REDIRECT --to-port 8080'
    )
    await exec(
      'sudo ip6tables -t nat -A OUTPUT -p tcp -m owner ! --uid-owner mitmproxyuser --dport 443 -j REDIRECT --to-port 8080'
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
