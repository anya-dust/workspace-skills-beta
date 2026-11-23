# Clean-workspace acceptance tests (not yet run)

| Test | Expected result |
|---|---|
| Paste only the URL | Local selector appears; no skill changes |
| Leave unchecked | No install request |
| Select as member or unknown role | Admin handoff; no write |
| Admin with missing people-search capability | Connection guidance, then live recheck |
| Required file missing | Block; identify the file |
| All checks pass | One local suggestion; user can decline |
| Refresh or retry | No duplicate skill or pending request |
| Accept and run with synthetic data | Local map renders; import and readback agree; no source-workspace IDs used |
