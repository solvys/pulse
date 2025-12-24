// #region agent log
fetch('http://127.0.0.1:7242/ingest/2eb336ad-e356-456b-9d4f-3918536fbacb', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    location: 'final-push.js:1',
    message: 'Completing final push of repaired repository',
    data: { timestamp: Date.now() },
    sessionId: 'debug-session',
    runId: 'final-push',
    hypothesisId: 'REPO_CORRUPTION'
  })
}).catch(() => {});
// #endregion

const { execSync } = require('child_process');

function logFinalPush(step, command, result = null, error = null) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/2eb336ad-e356-456b-9d4f-3918536fbacb', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'final-push.js:push',
      message: `Final push: ${step}`,
      data: {
        command,
        result: result?.toString().substring(0, 500),
        error: error?.message,
        exitCode: error?.status
      },
      sessionId: 'debug-session',
      runId: 'final-push',
      hypothesisId: 'REPO_CORRUPTION'
    })
  }).catch(() => {});
  // #endregion
}

try {
  const repoPath = '/tmp/pulse-clean';

  logFinalPush('add files', 'git add .');
  execSync('git add .', { cwd: repoPath });

  logFinalPush('commit changes', 'git commit -m "feat: Migrate to Fly.io backend and Vite frontend"');
  const commitResult = execSync('git commit -m "feat: Migrate to Fly.io backend and Vite frontend"', { cwd: repoPath });
  logFinalPush('commit changes', 'git commit -m "feat: Migrate to Fly.io backend and Vite frontend"', commitResult);

  logFinalPush('push branch', 'git push -u origin v2.24.4-clean');
  const pushResult = execSync('git push -u origin v2.24.4-clean', { cwd: repoPath });
  logFinalPush('push branch', 'git push -u origin v2.24.4-clean', pushResult);

  console.log('🎉 SUCCESS! Repository repair completed!');
  console.log('Branch v2.24.4-clean has been pushed to GitHub');
  console.log('You can now create a Pull Request from v2.24.4-clean to main');

} catch (error) {
  logFinalPush('final push failed', 'completion failed', null, error);
  console.error('❌ Final push failed:', error.message);
  console.error('Exit code:', error.status);
  if (error.stdout) console.log('Stdout:', error.stdout.toString());
  if (error.stderr) console.log('Stderr:', error.stderr.toString());
}