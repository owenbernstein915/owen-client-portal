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
