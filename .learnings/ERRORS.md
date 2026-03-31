# Errors

## 2026-03-31

- Context: Adding Render deployment docs and config.
- Error: `apply_patch` failed because the README patch used slightly mismatched context around the production section.
- Resolution: Re-read the exact README lines and re-applied a tighter patch.
- Prevention: When patching docs, read the exact target block first instead of relying on copied context.
