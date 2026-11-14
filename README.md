# Owen B Client Portal

Start with **START-HERE.md** for setup, current limitations, and Libélula-specific integration details.

- `public/`: responsive monochrome client editor and login UI.
- `netlify/functions/portal.mjs`: authenticated server endpoint.
- `server/`: fixed client mapping, field schema, validation, GitHub drafts/publishing.
- `tests/`: local server tests with simulated external services.
- `preview/`: offline design preview; excluded from deployment.

This project is separate from the client websites. The dashboard reads and publishes each site's approved content files through its Netlify Function.

## Client account setup

Add the client's lowercase email to `PORTAL_SIGNUP_ALLOWLIST_JSON` in the portal's Netlify environment variables, with `role` set to `editor` and `sites` containing only their site ID (`libelula` or `little-daisy`). Redeploy the portal after changing this variable. The current UUID mapping in `PORTAL_ACCESS_JSON` continues to work for existing users.

The client clicks **Create your account**, enters that email, opens the Supabase link, and chooses a password. This also works for an account previously invited but not yet confirmed. The server checks the allowlist before requesting an email, and checks the verified Supabase user and site assignment on every editing request. Supabase Auth must have email signup and email confirmation enabled, with the portal URL allowed as an Auth redirect. Test email delivery with a real approved inbox before inviting a client.

No Supabase database tables or service-role key are used by this flow. A new authorized email gains access through the server-side allowlist only after confirming ownership of that address.
# Website analytics

All assigned clients can open Analytics after signing in. The server validates the Supabase session and the server-owned website assignment before requesting data for that site's fixed Netlify ID. A dedicated `NETLIFY_ANALYTICS_TOKEN` can be stored as a secret scoped to production Functions; otherwise the server uses the existing `NETLIFY_API_TOKEN`. Neither value leaves the function. Browser clients cannot select arbitrary Netlify sites or receive the token. Imported reports still use the user's own JWT and database row-level policies.

Live analytics now uses **Netlify Observability**, not the legacy browser tracker. Options are exactly **Last Hour**, **Last 24 Hours**, and **Last 7 Days**. Every metric and breakdown is queried with the same `from_ts` / `to_ts`; the displayed end is exclusive and stops at the last complete minute. One-minute source data is grouped into one-minute, hourly or six-hour chart bars without sampling. Page views follow [Netlify's documented definition](https://docs.netlify.com/manage/monitoring/web-analytics/how-web-analytics-works/): HTML responses with status 200, 201 or 304. Request totals and bandwidth include all project traffic. No daily visitor counts are summed into a unique-visitor estimate; live cards show page views, web requests and data served instead. Netlify project data can include automated requests and project deploy URLs.

`server/netlify-analytics.mjs` uses the request/response contract from [Netlify's official MCP client](https://github.com/netlify/netlify-mcp/blob/main/src/tools/observability-tools/api-client.ts). Counts are authoritative; chart discrepancies during Netlify's log processing are disclosed rather than silently adjusted. If seven-day retention clips the first partial minute, all queries are repeated for the same complete available minutes and the displayed window states the limitation. Missing, truncated or malformed responses return an error rather than invented zero traffic. Netlify Web Analytics is a different, hourly-refreshed product; its saved 30-day report is kept separately and never added to live request totals.

The portal refreshes every minute while visible, on return after a minute away, on range/site changes, and when Refresh is clicked. Responses are `no-store`; each refresh queries Netlify again. Request sequencing prevents an older site/range response from replacing the current selection. The saved November 14 report is collapsed below the live report and explicitly does not follow the selector.

The legacy collector (`supabase/analytics.sql`, `supabase/functions/portal-collect/index.ts`, and the injected traffic script) remains separate; its events and visitor estimates are never queried for this dashboard. To add access, assign the verified Supabase account in the server-owned access configuration and add the matching membership for historical reports. Secrets remain server-side.


## Media Remixed editing

Media Remixed uses Supabase for published content, drafts, version history, and uploaded photos. `supabase/media-remixed-content.sql` records the schema. The source file `content/media-remixed.json` is the initial content seed; the database is authoritative after launch.

The portal validates every field and photo, forwards the verified user's own JWT, and checks their server-owned editor role. Independent database editor assignments and row-level policies restrict drafts, publishing and photos to Media Remixed's assigned editors. Public visitors can read only published content and published photos. Draft saves use revision checks; publishing updates the content and referenced photos in one transaction. The editor supports restoring a published version as a new draft. No service-role key is used.

The live site loads published content through `public/media-remixed.js`. All five pages retain a complete static fallback and their original video/design assets. Draft previews accept messages only from the exact portal parent origin. The Media Remixed static source archive contains the shared loader and frame policy; retain these in future design deployments. Libélula and Little Daisy continue to use the existing GitHub workflow.


## YouTube episodes and historical analytics — November 14, 2026

Media Remixed now uses the verified @mediaremixed channel (`UCRwSusbawKh_BrA1Nmw2atQ`). The `media-remixed-youtube` Supabase Edge Function checks its public Atom feed on request, caches successful results for five minutes, and preserves older discovered uploads in a service-written cache. It authenticates the publishable API key inside the function (`verify_jwt = false`). It accepts no feed URL, channel, or content from callers. No YouTube credentials are needed. Website episodes link directly to YouTube and use its thumbnails unless a custom image is chosen.

The Episodes editor has an automatic-sync toggle, a check-for-new-episodes button, editable titles/descriptions/links, reorder controls, and hide/show controls. New videos appear automatically; website overrides win over YouTube metadata. Removing a synced entry would cause it to return, so synced entries use Hide instead. Unchanged placeholders disappear once real uploads exist. A manual-only mode and manual episode additions remain available. The public display supports 100 episodes; the source cache retains the latest 500 discovered uploads. Feed failures retain saved episodes, with the most recent successful feed available as fallback.

`supabase/portal-history-youtube.sql` records the new table permissions. `portal_analytics_imports` stores private Netlify aggregate reports for the three sites. The November 14 import uses Netlify’s native 30-day report (Oct 15–Nov 14, current day partial), with page views, period unique visitors, bandwidth, daily figures, pages, sources and locations. Imported history is a collapsed, dated snapshot below the live Netlify report; overlapping counts are never summed. The historical snapshot is a one-time import, while live Netlify requests refresh automatically. Each client can read only its own imported report. Raw client analytics are not included in this repository.

Live connection verified November 14, 2026: all three ranges on Libélula, Little Daisy and Media Remixed matched direct Netlify queries for page views, requests and bandwidth bytes. Rolling retention can advance while the seven-day queries run; the server makes at most three attempts to obtain one consistent available window for every metric. Thirty automated tests and the production build passed.

The dedicated `Owen Client Portal Analytics` token is stored as a secret in `NETLIFY_ANALYTICS_TOKEN`, scoped to production Functions only. It expires **February 12, 2027**. Renew that token, update this environment variable and redeploy before expiration. The original publishing token is unchanged. No token value is stored in this repository or sent to browsers.
