# Owen B Client Portal

A separate client editing website for Netlify, styled to match owenbwebdesign.com: black backgrounds, off-white text, Arial typography, thin borders, rounded buttons, and your existing OB monogram. Libélula and Little Daisy are configured clients.

**Status:** source code and an offline design preview are prepared. This package has not been deployed or connected to your GitHub write credentials, Supabase account, or Netlify account. The real portal refuses access until configured. No changes have been pushed to Libélula's repository.

## 1. See the design

Unzip the download. Open `preview/index.html` in your browser. This is an offline design preview using a snapshot of Libélula's existing content. Saving a draft in this preview changes only memory in that tab; publishing is disabled. Open `preview/login.html` to view the matching login screen.

The production application is in `public/`; `preview/` is not published by the build.

## 2. Create a separate repository for the portal

Create a new GitHub repository, for example `owen-client-portal`. Upload this package's contents into its root, including `netlify.toml`, `package.json`, `public/`, `server/`, and `netlify/functions/`. Keep `.env` and all real tokens out of GitHub. The `.env.example` file contains placeholders only.

Do not replace Libélula's repository with this package. The portal is its own website and uses the GitHub API to read and edit the existing client repository.

## 3. Connect the portal repository to Netlify

In Netlify, add a project from the new GitHub repository.

- Base directory: leave blank.
- Build command: `npm run build`.
- Publish directory: `dist`.
- Functions directory: `netlify/functions` (already in `netlify.toml`).
- Node: 22 (already configured).

Use Git-based deployment. Dragging only the `dist` folder onto Netlify will not deploy the required server functions.

Netlify will assign a project URL. You can add `clients.owenbwebdesign.com` as a custom domain later. Adding a client subdomain does not require replacing your main portfolio website.

## 4. Set up client login with Supabase

Create a Supabase project. The portal uses Supabase only for email/password accounts; it does not need a custom database or a service-role key.

1. Enable email/password authentication.
2. Disable public signups: you control which business owners get accounts.
3. Set the Auth Site URL to your actual portal URL and add that same URL, ending in `/`, to the permitted redirect URLs.
4. Create your own user and the client's user in Supabase Auth. Copy each user's UUID. The server maps UUIDs to client sites; email text or user-editable metadata does not grant access.
5. Set up production SMTP for invitation and password-reset emails. Supabase's built-in sender is limited and should not be relied on for client email delivery.
6. Users can set their password from the invite link or the portal's password-reset flow. Complete a real invite and password-reset test before handing access to a business owner.

Useful official instructions: [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords) and [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 5. Give the server access to Libélula

In GitHub, create a fine-grained personal access token under Developer settings. Limit repository access to `owenbernstein915/libelula-pages-cms` and `owenbernstein915/little-daisy-bake-shop`, and set **Contents: Read and write**. Keep the token on the server. Select an expiration and renew it before it expires.

This token lets the portal save draft content and publish it to `main`. Existing protected-branch rules must permit the intended publishing workflow. If branch protection blocks publishing, keep those rules and adapt the portal to a pull-request workflow; do not disable protections just to make this prototype work.

For more clients, add only their intended repositories to the connection. A GitHub App with repository-specific installations is a useful later upgrade; this version uses the scoped token above.

[GitHub token instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## 6. Add environment variables in Netlify

Set these on the **portal project**, scoped to Functions. Enter actual values in Netlify, not in chat or GitHub.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Your project's HTTPS URL, e.g. `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Its publishable key or legacy anon key; never a service-role key |
| `GITHUB_TOKEN` | The fine-grained token from step 5 |
| `PORTAL_ACCESS_JSON` | The UUID-to-site mapping below |

Replace both UUID placeholders:

```json
{"YOUR_SUPABASE_USER_UUID":{"role":"admin","sites":["libelula","little-daisy"]},"LIBELULA_CLIENT_UUID":{"role":"editor","sites":["libelula"]},"LITTLE_DAISY_CLIENT_UUID":{"role":"editor","sites":["little-daisy"]}}
```

An administrator sees all sites listed in `server/clients.mjs`. An editor sees only assigned site IDs. Removing a UUID from this mapping revokes portal access on subsequent requests once the updated environment is active. Redeploy after setting or changing these variables.

Optional variables enable deployment status and automatic preview/live links:

| Variable | Value |
| --- | --- |
| `LIBELULA_NETLIFY_SITE_ID` | The Project ID of the **Libélula website**, not the portal |
| `LITTLE_DAISY_NETLIFY_SITE_ID` | The Project ID of the **Little Daisy website**, not the portal |
| `NETLIFY_API_TOKEN` | Your Netlify personal access token, stored only in Functions |

Without those optional variables, you can put verified `liveUrl` and `draftUrl` values in `server/clients.mjs`; build status will remain unavailable. Only claim an update is live after checking its completed Netlify deployment.

## 7. Verify Libélula's Netlify connection and enable draft previews

The inspected repository contains a project at the root and another copy inside `libelula-pages-cms-source/`. The portal targets the **root project**:

- `src/content/site.json`
- `src/content/menu.json`
- `public/images/uploads/`

Check Libélula's Netlify settings: repository `owenbernstein915/libelula-pages-cms`, production branch `main`, base directory blank, build command `npm run build`, publish directory `dist`. The repository contents do not prove which base directory your existing Netlify project currently uses; confirm it in Netlify before enabling publishing.

The portal creates `client-portal-draft` on the first save. Enable a branch deploy for this branch in **Libélula's** Netlify project if you want the Preview draft button to work. Keep production set to `main`. A publicly accessible repository also makes draft branch content public; do not put confidential announcements or personal information in those drafts. Configure preview access according to the client's needs.

Draft saves update the two JSON files and staged photos on the draft branch. Publishing copies only those content files, draft-uploaded images, and a small publication marker onto the latest `main` tree. It does not copy arbitrary draft-branch code changes. All branch updates use `force: false`.

[Netlify build configuration](https://docs.netlify.com/build/configure-builds/overview/).

## 8. Test before inviting the client

Use your own account first, with a preview/staging setup where appropriate:

1. Sign in and load Libélula's actual content.
2. Edit a small piece of text and save a draft. Confirm the live site remains unchanged.
3. Upload a photo and confirm it renders in the completed draft preview.
4. Review the draft, then publish an approved test change. Confirm its commit finishes building in Netlify and appears on the actual live site.
5. Restore a published version as a new draft and check it before publishing.
6. Verify a second account with no Libélula assignment cannot read, save, fetch images, or publish that website.
7. Test invite, password setup/reset, sign-out, and mobile editing.

The local test suite passed: original content validation; unsafe-link/empty-menu rejection; user/site separation; malformed-upload rejection; missing/invalid session rejection; draft isolation; content-only publishing without forced updates; subsequent drafting; and stale-revision rejection. External services were simulated for these tests. A local DOM check also verified field rendering, dirty-state updates, save controls, menu navigation, and login fields; it is not a visual browser test. Browser preview access was blocked in this environment, so desktop/mobile visual QA and actual production integrations remain to be checked in your browser.

## Notes specific to Libélula

- The website already imports its menu and page content from the configured JSON files. Existing page design can remain as it is.
- Website menu changes do not synchronize prices or availability to Toast. Update Toast separately when those need to change.
- Displayed business hours are editable. The existing `availableTimes()` function in `src/App.jsx` has hardcoded reservation-picker hours. A schedule change also needs an update to that function; the portal includes a reminder in the hours section. Toast continues to determine actual booking availability.
- Existing Pages CMS editing can remain available. Pages CMS edits on `main` publish according to its existing workflow; the portal's draft/publish separation applies only to edits made through this portal. Avoid simultaneous editing in both systems. Stale portal drafts are blocked rather than silently overwriting newer work.
- If a draft is stale, export it, review the changes with Owen, and reconcile it with current live content. The portal deliberately does not auto-merge conflicting business content.
- Version history begins with the first portal publish; existing Git history remains available in GitHub.

## Add the next business

Add a new entry in `server/clients.mjs` with a unique ID, its repository, production/draft branch, approved content-file schema, and image folder. Grant the corresponding user UUID that site ID in `PORTAL_ACCESS_JSON`, grant the GitHub connection access to that repository, and redeploy the portal. Websites with different structures need their own field schemas and must read those editable files.

## Local development

Node 22 or newer:

```bash
npm test
npm run build
npm run dev
```

No application packages need to be downloaded. For real local service access, copy `.env.example` to `.env` and enter your values locally. The dev server listens only on `127.0.0.1:4173`.

Source reference inspected: `owenbernstein915/libelula-pages-cms`, commit `edfd10d765ce5c1422afb763320be9a8af0db302`. Visual reference: `owenbwebdesign.com/styles.css` and its existing OB monogram.
