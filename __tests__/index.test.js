/**
 * Unit tests for the action's entrypoint, src/index.js
 */

const { run } = require('../src/main')
const { generateSummary } = require('../src/summary')

// Mock the action's entrypoint
jest.mock('../src/main', () => ({
  run: jest.fn()
}))

jest.mock('../src/summary', () => ({
  generateSummary: jest.fn()
}))

describe('index', () => {
  it('calls run when imported on linux', async () => {
    jest.mock('os', () => ({
      platform: jest.fn().mockReturnValue('linux'),
      arch: jest.fn().mockReturnValue('x64')
    }))
    const { init } = require('../src/index')

    expect(run).toHaveBeenCalled()

    init('linux', 'x64')

    expect(generateSummary).toHaveBeenCalled()
  })

  it('fails when imported on platform other than linux', async () => {
    jest.mock('os', () => ({
      platform: jest.fn().mockReturnValue('darwin'),
      arch: jest.fn().mockReturnValue('x64')
    }))
    require('../src/index')

    expect(run).not.toHaveBeenCalled()
  })

  it('should return an array', async () => {
    const { getTrustedGithubAccounts } = require('../src/input')

    const accounts = getTrustedGithubAccounts()

    expect(accounts).toBeInstanceOf(Array)
  })

  it('should return a boolean', async () => {
    const { getAllowHTTP } = require('../src/input')

    const flag = getAllowHTTP()

    expect(typeof flag).toBe('boolean')
  })
})
