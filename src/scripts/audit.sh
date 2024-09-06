#! /bin/bash

workingDir=$1
debug=$2

if [[ "$debug" == "true" ]]; then
	set -x
fi

if ! command -v auditd &>/dev/null; then
	echo "Installing auditd..."
	sudo apt-get install auditd -y
	echo "auditd installed successfully."
else
	echo "auditd is already installed."
fi

# Script expects audit.rules file to be in the same directory
# Move audit.rules file to /etc/audit/rules.d/ directory
mv audit.rules /etc/audit/rules.d/

# Restart auditd service to apply the new rules
service auditd restart

auditctl -w "$workingDir" -p wa -k bolt_monitored_wd_changes -F "exclude=$workingDir/.git"

auditctl -e 2
