import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/api/github/commit/route.ts", "utf8");

assert.match(
  source,
  /credentialSource === "github-app" && repositoryAccessDenied/,
  "a repository-scoped GitHub App access failure must enter the OAuth fallback path",
);
assert.match(
  source,
  /repositoryResponse\.response\.status === 403 \|\| repositoryResponse\.response\.status === 404/,
  "only explicit App repository access failures may activate the fallback",
);
assert.match(
  source,
  /await checkGithubOAuthRepositoryWrite\(oauthToken, connection\.selected_repo\)/,
  "OAuth fallback must verify push permission against the selected repository",
);
assert.match(
  source,
  /repositoryResponse = await githubRequest\(api\(""\), \{ headers \}\)/,
  "the selected repository must be re-read with the verified OAuth credential before any mutation",
);
assert.match(
  source,
  /The selected repository is not included in the connected GitHub App installation/,
  "a denied App-only repository must show its real access problem rather than a misleading Not Found error",
);

console.log("GitHub App repository-scope fallback checks passed.");
