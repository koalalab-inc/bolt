async function boltService(
  boltUser,
  mode,
  allowHTTP,
  defaultPolicy,
  trustedGithubAccountsString,
  logFile,
  errorLogFile
) {
  return `
[Unit]
Description=bolt
After=network.target

[Service]
Type=simple
User=${boltUser}
Group=${boltUser}
ExecStart=/home/${boltUser}/mitmdump --mode transparent --showhost --set block_global=false -s /home/${boltUser}/intercept.py
Restart=always
Environment="BOLT_MODE=${mode}"
Environment="BOLT_ALLOW_HTTP=${allowHTTP}"
Environment="BOLT_DEFAULT_POLICY=${defaultPolicy}"
Environment="BOLT_TRUSTED_GITHUB_ACCOUNTS=${trustedGithubAccountsString}"
StandardOutput=file:${logFile}
StandardError=file:${errorLogFile}

[Install]
WantedBy=multi-user.target
`
}

module.exports = { boltService }
