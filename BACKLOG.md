# Backlog

## UI Auto-Refresh for MCP Changes

When using the MCP server to apply effects or save presets, the web UI doesn't automatically reflect those changes. Users must manually refresh the browser to see new outputs or presets.

**Options to consider:**
- Add a "Refresh" button to manually update results and presets
- Add auto-polling every few seconds
- Add WebSocket support for real-time updates

**Impact:** Low priority - doesn't affect functionality, but affects UX when using MCP programmatically
