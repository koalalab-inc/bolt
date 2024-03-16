const { error } = require('@actions/core')

async function boltPlist(
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
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.koalalab.bolt</string>
    <key>ProgramArguments</key>
    <array>
        <string>${homeDir}/mitmproxy.app/Contents/MacOS/mitmdump</string>
        <string>--mode</string>
        <string>transparent</string>
        <string>--showhost</string>
        <string>--set</string>
        <string>block_global=false</string>
        <string>-s</string>
        <string>${homeDir}/intercept.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${homeDir}</string>
    <key>StandardOutPath</key>
    <string>${logFile}</string>
    <key>StandardErrorPath</key>
    <string>${errorLogFile}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>BOLT_MODE</key>
        <string>${mode}</string>
        <key>BOLT_ALLOW_HTTP</key>
        <string>${allowHTTP}</string>
        <key>BOLT_DEFAULT_POLICY</key>
        <string>${defaultPolicy}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>UserName</key>
    <string>${boltUser}</string>
    <key>GroupName</key>
    <string>${boltGroup}</string>
</dict>
</plist>
`
}

module.exports = { boltPlist }
