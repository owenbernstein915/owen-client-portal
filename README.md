# Owen B Client Portal

Start with **START-HERE.md** for setup, current limitations, and Libélula-specific integration details.

- `public/`: responsive monochrome client editor and login UI.
- `netlify/functions/portal.mjs`: authenticated server endpoint.
- `server/`: fixed client mapping, field schema, validation, GitHub drafts/publishing.
- `tests/`: local server tests with simulated external services.
- `preview/`: offline design preview; excluded from deployment.

This project is separate from the Libélula website. It is prepared for Netlify but still requires account configuration and a real deployment test.
