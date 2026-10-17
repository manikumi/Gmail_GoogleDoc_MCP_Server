// One-time helper: signs in with Google and writes token.json, then exits.
// Usage: npm run auth
import { createOAuthClient, getNewToken } from './auth';

createOAuthClient()
  .then(getNewToken)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Authorization failed:', e.message || e);
    process.exit(1);
  });
