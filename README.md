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

All assigned clients can open Analytics after signing in. Little Daisy, Libélula, and Media Remixed have content editors for assigned editors and administrators. Viewer accounts retain analytics-only access. The server validates the Supabase session and website assignment before calling the database with the user's own JWT. Supabase row-level policies independently restrict every site's data to its assigned accounts.

`supabase/analytics.sql` records the deployed schema. `supabase/functions/portal-collect/index.ts` is the write-only collector; it authenticates the publishable API key itself (`verify_jwt = false` for modern keys), validates production origins, drops known bots and privacy opt-outs, and limits a visitor to 60 events per minute. It stores paths, referring hostnames, device categories, and a daily rotating keyed visitor hash. No raw IP, full referrer URL, query string, cookie, or persistent browser identifier is stored. Browser blockers can reduce counts. Daily visitor estimates reset at midnight UTC; the dashboard averages those daily counts, not cross-day unique people.

Netlify snippet injection adds `<script defer src="https://owenbclientdashboard.netlify.app/.netlify/functions/traffic"></script>` to the three production client websites. The tracker excludes other hosts, embedded previews, and `portalEditor` mode. Tracking starts when installed; it does not backfill historical traffic or include podcast/Substack platform analytics. The dashboard supports 7-, 30-, and 90-day windows. All dates aggregate in UTC.

To add access, create the Supabase account, assign the website in the server-owned access configuration, and insert the matching `(site_id, user_id)` into `portal_site_memberships`. Clients have no database write permissions. Secrets stay in Netlify Functions or Supabase's managed function environment.


## Media Remixed editing

Media Remixed uses Supabase for published content, drafts, version history, and uploaded photos. `supabase/media-remixed-content.sql` records the schema. The source file `content/media-remixed.json` is the initial content seed; the database is authoritative after launch.

The portal validates every field and photo, forwards the verified user's own JWT, and checks their server-owned editor role. Independent database editor assignments and row-level policies restrict drafts, publishing and photos to Media Remixed's assigned editors. Public visitors can read only published content and published photos. Draft saves use revision checks; publishing updates the content and referenced photos in one transaction. The editor supports restoring a published version as a new draft. No service-role key is used.

The live site loads published content through `public/media-remixed.js`. All five pages retain a complete static fallback and their original video/design assets. Draft previews accept messages only from the exact portal parent origin. The Media Remixed static source archive contains the shared loader and frame policy; retain these in future design deployments. Libélula and Little Daisy continue to use the existing GitHub workflow.
