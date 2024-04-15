const ejs = require('ejs')
const fs = require('fs')
const wrapperTemplate = fs.readFileSync('src/wrappers/wrapper.ejs', 'utf-8')

// Render audit.sh.js
const auditShData = {
  name: 'auditScript',
  args: [],
  body: fs.readFileSync('src/scripts/audit.sh', 'utf-8')
}

fs.writeFileSync(
  'src/generated/audit.sh.js',
  ejs.render(wrapperTemplate, auditShData)
)

const createBoltUserData = {
  name: 'createBoltUserScript',
  args: [],
  body: fs.readFileSync('src/scripts/create-bolt-user.sh', 'utf-8')
}

fs.writeFileSync(
  'src/generated/create-bolt-user.sh.js',
  ejs.render(wrapperTemplate, createBoltUserData)
)

const iptablesData = {
  name: 'iptablesScript',
  args: [],
  body: fs.readFileSync('src/scripts/iptables.sh', 'utf-8')
}

fs.writeFileSync(
  'src/generated/iptables.sh.js',
  ejs.render(wrapperTemplate, iptablesData)
)
