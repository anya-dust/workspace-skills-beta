# Frank’s account map

Build a stakeholder map in a Dust Pod: contacts, deal roles and verified reporting lines. The research step needs a people-search connection. LinkedIn is a fallback; Salesforce and HubSpot are optional. No Dust-internal usage data is queried.

Start at the [catalog](../../README.md) in your destination workspace. The admin selects this skill, checks the required connections, and reviews a local skill proposal.

## Package

- `source-instructions.html`: account research and import rules. These take precedence over legacy examples. Never infer an email address or write human-owned contact fields.
- `template-instructions.html`: the nested installation and layout method, included locally.
- `assets/`: Frame UI, database, server functions, layout mapping and supporting documentation.
- `expected-files.json` and `checksums.json`: inventory and SHA-256 verification for this public beta.
