# GitHub API Audit Notes — 2026-08-18

## Official documentation findings

GitHub now recommends GitHub Apps for least-privilege integrations. An installation can access only repositories selected by the installer and only permissions granted to the App. For a Nexo repository integration, the App must request the **Repository contents: Read and write** permission. If Nexo is expected to modify files in `.github/workflows`, it must also request **Repository workflows: Read and write**; this repair will not request that broader permission unless the feature explicitly needs it.

A GitHub App installation callback alone does not confer usable server-side credentials. The server must:

1. receive and securely store the installation ID;
2. generate a short-lived App JWT signed with the App ID and private key;
3. exchange that JWT using `POST /app/installations/{installation_id}/access_tokens`;
4. use the returned installation token for API operations; and
5. renew it before expiry. Installation tokens expire after one hour and must not be assumed to be a fixed length because GitHub began rolling out a stateless token format in 2026.

GitHub REST requests should use `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, and an explicit `X-GitHub-Api-Version: 2026-03-10` header.

For atomic multi-file commits, the supported sequence is Git Data API operations: read the selected repository's default branch/ref, create blobs, create a tree based on the current tree, create a commit with the base commit as parent, and `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` with `force: false`. Branch names must be based on the repository's `default_branch`, not hard-coded to `main`. Pull-request mode additionally creates a new reference and then posts to `/repos/{owner}/{repo}/pulls`.

GitHub OAuth app scopes still work but are coarse-grained: `repo` grants read/write to public and private repositories, while `public_repo` grants read/write only to public repositories. OAuth scope inspection is available in `X-OAuth-Scopes`; this must not be treated as proof that a selected repository is writable. A GitHub App installation with Contents write is the needed server-side write-capability model for the Nexo user requirement.

## Current Nexo defects confirmed

- The GitHub App callback only attempts to write `installation_id`, but production `github_connections` does not contain that column.
- The app-install callback never mints an installation access token, and no App ID/private-key configuration exists.
- The commit route only decrypts the legacy OAuth token and never uses an installation token.
- The route hard-codes `main` rather than the selected repository's default branch.
- The UI selects direct/PR mode and a branch name, but `app/page.tsx` does not pass either field to `/api/github/commit`.
- GitHub conversation memory currently writes `.nexo-memory` files automatically, with no approval card; this violates the product requirement that every repository write requires user approval.
- The integration status route incorrectly treats any encrypted access token as write access.

## Sources

1. https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
2. https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
3. https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app
4. https://docs.github.com/en/rest/repos/contents
5. https://docs.github.com/en/rest/git/commits
6. https://docs.github.com/en/rest/git/refs
7. https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
8. https://docs.github.com/en/rest/overview/permissions-required-for-github-apps


## Additional verification — 2026-08-18

- GitHub’s current REST version is `2026-03-10`; GitHub explicitly recommends sending it through `X-GitHub-Api-Version`.[^api-version]
- Nexo’s pull-request mode performs `POST /repos/{owner}/{repo}/pulls`, so the GitHub App must also grant the repository-level **Pull requests: Read and write** permission in addition to **Contents: Read and write**. If users should be able to approve edits under `.github/workflows`, add the separate **Workflows: Read and write** permission as well.[^pulls][^contents]

[^api-version]: https://docs.github.com/en/rest/about-the-rest-api/api-versions
[^pulls]: https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request
[^contents]: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
