# Errors

## 2026-03-31

- Context: Adding Render deployment docs and config.
- Error: `apply_patch` failed because the README patch used slightly mismatched context around the production section.
- Resolution: Re-read the exact README lines and re-applied a tighter patch.
- Prevention: When patching docs, read the exact target block first instead of relying on copied context.

- Context: Verifying and controlling the Vercel deployment from the local machine.
- Error: `npx vercel` could not inspect or trigger deployments because no Vercel credentials were configured in this environment.
- Resolution: Used GitHub commit status plus cache-busted fetches of the public URL to confirm the production deployment completed and the latest asset hashes were live.
- Prevention: For future late-night deploy checks, keep either Vercel CLI auth configured locally or rely on GitHub deployment statuses as the first verification step.
