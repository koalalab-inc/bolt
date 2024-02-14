async function boltService(mode, allow_http, default_policy) {
    return `
[Unit]
Description=bolt
After=network.target

[Service]
Type=simple
User=mitmproxyuser
Group=mitmproxyuser
ExecStart=/home/mitmproxyuser/.local/bin/mitmdump --mode transparent --showhost --set block_global=false -s /home/mitmproxyuser/intercept.py
Restart=always
Environment="BOLT_MODE=${mode}"
Environment="BOLT_ALLOW_HTTP=${allow_http}"
Environment="BOLT_DEFAULT_POLICY=${default_policy}"
StandardOutput=file:/home/mitmproxyuser/bolt.log
StandardError=file:/home/mitmproxyuser/bolt-error.log


[Install]
WantedBy=multi-user.target
    `
}

module.exports = { boltService }