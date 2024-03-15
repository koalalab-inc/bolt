async function boltSudoers(boltUser) {
  return `
${boltUser} ALL=(root) NOPASSWD:ALL
runner ALL=(${boltUser}) NOPASSWD:ALL
`
}

module.exports = { boltSudoers }
