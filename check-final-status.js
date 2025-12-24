// #region agent log
fetch('http://127.0.0.1:7242/ingest/2eb336ad-e356-456b-9d4f-3918536fbacb', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location: 'check-final-status.js:1',
    message: 'Checking final status of clean repair',
    data: { timestamp: Date.now() },
    sessionId: 'debug-session',
    runId: 'final-status-check',
    hypothesisId: 'REPO_CORRUPTION'
  })
}).catch(() => {});
// #endregion

const { execSync } = require('child_process');

function logStatus(step, command, result = null, error = null) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2eb336ad-e356-456b-9d4f-3918536fbacb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'check-final-status.js:status',
      message: `Final status: ${step}`,
      data: {
        command,
        result: result?.toString().substring(0, 1000),
        error: error?.message,
        exitCode: error?.status
      },
      sessionId: 'debug-session',
      runId: 'final-status-check',
      hypothesisId: 'REPO_CORRUPTION'
    })
  }).catch(() => {});
  // #endregion
}

try {
  const repoPath = '/tmp/pulse-clean';

  // Check git status
  logStatus('status', 'git status');
  const status = execSync('git status', { cwd: repoPath });
  logStatus('status', 'git status', status);

  // Check git log
  logStatus('log', 'git log --oneline -3');
  const log = execSync('git log --oneline -3', { cwd: repoPath });
  logStatus('log', 'git log --oneline -3', log);

  // Check remote branches
  logStatus('remote branches', 'git branch -r');
  const remoteBranches = execSync('git branch -r', { cwd: repoPath });
  logStatus('remote branches', 'git branch -r', remoteBranches);

  console.log('=== FINAL CLEAN REPOSITORY STATUS ===');
  console.log('Status:', status.toString());
  console.log('Recent commits:', log.toString());
  console.log('Remote branches:', remoteBranches.toString());

  // Check if our branch exists on remote
  const hasRemoteBranch = remoteBranches.toString().includes('origin/v2.24.4-clean');
  console.log('Branch pushed to remote:', hasRemoteBranch ? 'YES' : 'NO');

} catch (error) {
  logStatus('status check failed', 'final status check', null, error);
  console.error('❌ Status check failed:', error.message);
}