const core = require('@actions/core')

const { generateTestResults, getUniqueBy } = require('./summary_utils')

// For testing locally
// const boltPID = "1479"
// const githubRunnerPID = '1446'

// function printNode(node, depth = 0) {
//   if (depth === 0) {
//     console.log(node.model.pid)
//   } else {
//     console.log(`${'  '.repeat(depth - 1)}- ${node.model.pid}`)
//   }
//   node.children.forEach(c => printNode(c, depth + 1))
// }

function NewNode(pid) {
  return {
    pid,
    isAction: false,
    parent: null,
    children: []
  }
}

function createProcessTree(processTuples) {
  const githubRunnerPID = core.getState('githubRunnerPID')
  const processMap = {}

  for (const [ppid, pid] of processTuples) {
    if (!processMap[pid]) {
      processMap[pid] = NewNode(pid)
    }
    if (!processMap[ppid]) {
      processMap[ppid] = NewNode(ppid)
    }

    processMap[pid].parent = processMap[ppid]
    processMap[ppid].children.push(processMap[pid])
    if (ppid === githubRunnerPID) {
      processMap[pid].isAction = true
    }
  }

  return processMap
}

function parentAction(node) {
  if (node?.isAction) {
    // return node
    return parentAction(node.parent) || node
  }
  if (node?.parent) {
    return parentAction(node.parent)
  }
  return null
}

async function getSudoCallingActions() {
  const boltPID = core.getState('boltPID')
  const githubRunnerPID = core.getState('githubRunnerPID')
  const audit = await generateTestResults('audit.json')

  const processExecAudit = audit.filter(
    a => a.process?.ppid && a.tags?.includes('bolt_monitored_process_exec')
  )
  const actionsProcessExecAudit = processExecAudit.filter(
    a => a.process?.ppid === githubRunnerPID
  )

  const processMap = {}
  const processPIDLookup = {}
  for (const log of processExecAudit) {
    const parent_pid = log.process?.ppid
    const pid = log.process?.pid
    if (pid && processPIDLookup[pid] === undefined) {
      processPIDLookup[pid] = log.process
    }
    if (parent_pid && pid) {
      const pids = processMap[parent_pid] || []
      if (!pids.includes(pid)) {
        processMap[parent_pid] = [...pids, pid]
      }
    }
  }
  const processTuples = []
  processTuples.push([githubRunnerPID, boltPID])
  for (const [parent, children] of Object.entries(processMap)) {
    for (const child of children) {
      processTuples.push([parent, child])
    }
  }

  const processTree = createProcessTree(processTuples)

  const sudoCalls = processExecAudit.filter(
    a => a.process?.exe === '/usr/bin/sudo'
  )
  const actionSudoCalls = sudoCalls.filter(
    a => parentAction(processTree[a.process.pid]) !== null
  )

  const nonActionSudoCalls = sudoCalls.filter(
    a => parentAction(processTree[a.process.pid]) === null
  )
  // console.log(nonActionSudoCalls.map(a => a.process));

  const sudoCallingActions = getUniqueBy(
    actionSudoCalls.map(a => {
      const sudoProcess = a.process
      const action = parentAction(processTree[a.process.pid])
      let actionName
      if (action.pid === boltPID) {
        actionName = 'koalalab-inc/bolt'
      } else {
        const actionProcess = processPIDLookup[action.pid]
        const actionArgs = actionProcess?.args
        actionName = actionArgs[actionArgs.length - 1]
          ?.split('/')
          .slice(5, 7)
          .join('/')
      }
      if (actionName.endsWith('.sh')) {
        actionName = 'Shell Script'
      }
      return {
        actionName,
        sudoCmd: sudoProcess.args?.join(' ')
      }
    }),
    ['actionName']
  )

  return sudoCallingActions
}

async function getZeroState() {
  const zeroState = core.summary
    .addQuote('Good job! No actions using sudo.')
    .stringify()
  core.summary.emptyBuffer()
  return zeroState
}

async function getAuditSummary() {
  const sudoCallingActions = await getSudoCallingActions()

  if (sudoCallingActions.length === 0) {
    const zeroState = getZeroState()
    return {
      zeroState
    }
  }

  const tableData = [
    [{ data: 'Actions using sudo', header: true }],
    ...sudoCallingActions.map(a => [a.actionName])
  ]

  const header = core.summary.addHeading('🚨 Actions using sudo', 4).stringify()
  core.summary.emptyBuffer()

  const body = core.summary.addTable(tableData).stringify()
  core.summary.emptyBuffer()

  return {
    header,
    body
  }
}

module.exports = {
  getAuditSummary
}
