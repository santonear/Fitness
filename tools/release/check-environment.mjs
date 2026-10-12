// Fail closed unless the GitHub environment exists and requires a reviewer.
// Usage (in Actions): GH_TOKEN=... node tools/release/check-environment.mjs cloudflare-production
const name = process.argv[2];
const {GITHUB_REPOSITORY: repo, GITHUB_API_URL: api = 'https://api.github.com', GH_TOKEN: token} = process.env;
if (!name || !repo || !token) throw Error('environment name, GITHUB_REPOSITORY and GH_TOKEN are required');

const response = await fetch(`${api}/repos/${repo}/environments/${encodeURIComponent(name)}`, {
  headers: {authorization: `Bearer ${token}`, accept: 'application/vnd.github+json'},
});
if (!response.ok) {
  console.error(`Cannot read environment "${name}" (HTTP ${response.status}). Create it and add a required reviewer first.`);
  process.exit(1);
}
const environment = await response.json();
const rule = (environment.protection_rules ?? []).find(item => item.type === 'required_reviewers');
if (!rule || !(rule.reviewers ?? []).length) {
  console.error(`Environment "${name}" has no required reviewer. Add one in Settings → Environments before releasing.`);
  process.exit(1);
}
const reviewers = rule.reviewers.map(item => item.reviewer?.login ?? item.reviewer?.name).join(', ');
console.log(`Environment "${name}" requires approval from: ${reviewers}`);
