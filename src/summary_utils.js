const fs = require('fs')

async function generateTestResults(filePath) {
  try {
    // Read the entire file synchronously and split it into an array of lines
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const lines = fileContent.split('\n')

    // Initialize an empty array to store JSON objects
    const jsonArray = []

    // Iterate through each line and parse it as JSON
    for (const line of lines) {
      if (line.length === 0) continue
      try {
        const jsonObject = JSON.parse(line)
        jsonArray.push(jsonObject)
      } catch (error) {
        console.error(`Error parsing JSON on line: ${line}`)
      }
    }

    return jsonArray
  } catch (error) {
    console.error(`Error reading file: ${error.message}`)
    return []
  }
}

function getGithubCalls(githubCallsFilename) {
  try {
    const githubCallsFileContent = fs.readFileSync(githubCallsFilename, 'utf-8')
    const lines = githubCallsFileContent.split('\n')

    const githubCalls = []

    for (const line of lines) {
      if (line.length === 0) continue
      try {
        const githubCall = JSON.parse(line)
        githubCalls.push(githubCall)
      } catch (error) {
        console.error(`Error parsing JSON on line: ${line}`)
      }
    }

    return githubCalls
  } catch (error) {
    console.error(`Error reading file: ${error.message}`)
    return []
  }
}

function getUniqueBy(arr, keys) {
  const uniqueObj = arr.reduce((unique, o) => {
    const key = keys.map(k => o[k]).join('|')
    unique[key] = o
    return unique
  }, {})
  return Object.values(uniqueObj)
}

function getRawCollapsible({ body, header }) {
  return `
<details open>
  <summary>
    ${header}
  </summary>
  ${body}
</details>  
`
}

module.exports = {
  generateTestResults,
  getGithubCalls,
  getUniqueBy,
  getRawCollapsible
}
