# GitHub App write-access research

GitHub recommends GitHub Apps over OAuth Apps for most integrations because Apps support fine-grained permissions, selected-repository installations, short-lived installation tokens, and centralized webhooks. OAuth Apps use broader scopes and access the resources available to the authorizing user.

For Kyvorix's current server-side installation-token flow, the minimum GitHub App repository permissions should be `Metadata: Read-only` and `Contents: Read & write`. Add `Workflows: Read & write` only if Kyvorix will edit files under `.github/workflows`. Issues, Pull requests, organization permissions, account permissions, and enterprise permissions are not required for the current file proposal/commit flow.

The current code already contains the backend pieces for App JWT signing and installation-token exchange in `lib/githubApp.server.ts`, an installation start route at `/api/github/app-install`, and a setup callback at `/api/github/app-callback`. The expected server variables are `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, and `GITHUB_APP_PRIVATE_KEY`. The current Integrations UI has a route helper for `/api/github/app-install`, but the visible read-only reconnect button currently starts `/api/github/login`; the UI upgrade action still needs to be wired to the App installation route.

Because the current flow uses an installation access token and not a GitHub App user access token, the GitHub App's user-authorization callback URL and client secret are not required for the write upgrade. The App's Setup URL should be the production app URL plus `/api/github/app-callback`. If user authorization is enabled later, configure a separate exact Callback URL and use PKCE/state; GitHub says the callback URL is distinct from the Setup URL.

Sources:
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-user-authorization-callback-url
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
