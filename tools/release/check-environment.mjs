// Fail closed unless the GitHub environment exists and deploys only from main.
// A production run starts only when Bo runs it by hand (Bo 2026-10-22, decided while
// the repo was private). The repo is now public, so GitHub also allows a required
// reviewer on this environment; until Bo adds one, the log below says there is none.
// Usage (in Actions): GH_TOKEN=... node tools/release/check-environment.mjs cloudflare-production
const name = process.argv[2];
const { GITHUB_REPOSITORY: repo, GITHUB_API_URL: api = 'https://api.github.com', GH_TOKEN: token } = process.env;
if (!name || !repo || !token) throw Error('environment name, GITHUB_REPOSITORY and GH_TOKEN are required');

const response = await fetch(`${api}/repos/${repo}/environments/${encodeURIComponent(name)}`, {
  headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
});
if (!response.ok) {
  console.error(`Cannot read environment "${name}" (HTTP ${response.status}). Create it first.`);
  process.exit(1);
}
const environment = await response.json();
const policy = environment.deployment_branch_policy;
if (!policy || policy.protected_branches || !policy.custom_branch_policies) {
  console.error(`Environment "${name}" must limit deployments to selected branches (main).`);
  process.exit(1);
}
const rule = (environment.protection_rules ?? []).find(item => item.type === 'required_reviewers');
const reviewers = (rule?.reviewers ?? []).map(item => item.reviewer?.login ?? item.reviewer?.name).join(', ');
console.log(
  reviewers
    ? `Environment "${name}" requires approval from: ${reviewers}`
    : `Environment "${name}" has no required reviewer; this run was started by ${process.env.GITHUB_TRIGGERING_ACTOR ?? 'unknown'}.`,
);
