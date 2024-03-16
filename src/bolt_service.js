async function boltService(
  boltUser,
  boltGroup,
  homeDir,
  mode,
  allowHTTP,
  defaultPolicy,
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
ExecStart=${homeDir}/mitmdump --mode transparent --showhost --set block_global=false -s ${homeDir}/intercept.py
Restart=always
Environment="BOLT_MODE=${mode}"
Environment="BOLT_ALLOW_HTTP=${allowHTTP}"
Environment="BOLT_DEFAULT_POLICY=${defaultPolicy}"
StandardOutput=file:${logFile}
StandardError=file:${errorLogFile}

[Install]
WantedBy=multi-user.target
`
}

module.exports = { boltService }
