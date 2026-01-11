# SSE Status Widget & Debug Panel - Verification Guide

**Date:** 2025-12-31  
**Author:** DarkMoon  
**Context:** Fix SSE "Discovering" widget stuck on red, add debug panel

## What Was Fixed

1. **SSR Issue** - `getOpencodeConfig()` now handles server-side rendering safely
2. **Status Widget** - Now reflects actual multiServerSSE connection state
3. **Debug Panel** - New panel for SSE health monitoring

## Manual Verification Steps

### 1. SSE Widget Status Colors

**Test:** Start the dev server and navigate to the projects list page.

```bash
bun dev
# Open http://localhost:3000
```

**Expected Behavior:**

1. **On page load:**
   - Widget shows yellow dot with "discovering..."
   - After 1-5 seconds, should show green dot with "connected (N)" where N is the number of servers

2. **Color States:**
   - 🟢 Green = connected to at least one server
   - 🟡 Yellow = discovering servers (discovery in progress)
   - 🔴 Red = disconnected (no servers found or all connections failed)

3. **Server Count:**
   - If you have 2 projects running, should show "connected (2)"
   - If you have 1 project running, should show "connected (1)"

### 2. Debug Panel

**Test:** Click the SSE status widget in the bottom-right corner.

**Expected Behavior:**

1. **Panel Opens:**
   - Modal/overlay appears
   - Shows title "SSE Debug Panel"
   - Has close button (X) and "Reconnect" button

2. **Discovered Servers Section:**
   - Lists each discovered server
   - Shows port number (e.g., "Port 4056")
   - Shows connection state badge (connected/connecting/disconnected)
   - Shows directory path (if available)
   - Shows "Last event: Xs ago"

3. **Recent Events Section:**
   - Shows last 10 SSE events received
   - Each event shows: timestamp, event type, directory
   - Events are in reverse chronological order (newest first)

4. **Connection Info:**
   - Shows "Discovery: Complete" or "Discovery: In progress..."
   - Shows "Connected servers: X / Y"

5. **Reconnect Button:**
   - Click "Reconnect" button
   - Widget should briefly show "discovering..."
   - Then reconnect and show "connected (N)"

### 3. Live Session Indicators

**Test:** Open a session and send a message to trigger AI response.

**Expected Behavior:**

1. **On Projects List:**
   - Session shows green pulsing dot while AI is responding
   - Dot turns gray after AI completes response (with 60s cooldown)

2. **Session Status:**
   - Status derived from last message's completion state
   - AI streaming → green pulsing dot
   - AI completed → gray dot (after 60s cooldown)

### 4. SSR Error Check

**Test:** Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R).

**Expected Behavior:**

1. **No Console Errors:**
   - Open browser DevTools console
   - Hard refresh the page
   - Should NOT see "OpenCode: No configuration found" error
   - Should NOT see any errors about `window is not defined`

2. **Page Renders:**
   - Projects list renders correctly
   - Sessions render correctly
   - SSE widget appears and works

### 5. Debug Panel Event Log

**Test:** Send a message in a session and watch the debug panel.

**Expected Behavior:**

1. **Events Appear:**
   - Open debug panel
   - Send a message in a session
   - Should see events like:
     - `session.status` (session starting)
     - `message.updated` (message streaming)
     - `part.updated` (parts updating)
     - `session.status` (session completed)

2. **Event Details:**
   - Timestamp is current
   - Event type is correct
   - Directory matches session directory

## Common Issues & Fixes

### Widget Stuck on Yellow "Discovering..."

**Symptoms:**
- Widget never turns green
- Debug panel shows no servers

**Check:**
1. Is the OpenCode backend running?
2. Check `/api/opencode-servers` endpoint (should return array of servers)
3. Check browser console for fetch errors

**Fix:**
- Start the OpenCode backend
- Check that discovery endpoint is accessible

### Widget Shows Red "Disconnected"

**Symptoms:**
- Widget turns red after being yellow
- Debug panel shows servers in "disconnected" state

**Check:**
1. Are SSE connections failing?
2. Check browser console for connection errors
3. Check network tab for failed `/api/sse/${port}` requests

**Fix:**
- Verify SSE proxy endpoints are working
- Check that backend SSE endpoint is responding
- Click "Reconnect" in debug panel

### Events Not Showing in Debug Panel

**Symptoms:**
- Debug panel opens but "Recent Events" is empty
- Sessions send messages but no events appear

**Check:**
1. Is SSE connection established? (widget should be green)
2. Are events being filtered by directory?
3. Check browser console for event parsing errors

**Fix:**
- Verify multiServerSSE is receiving events (check console logs)
- Check that event handler is subscribing correctly

### Live Session Indicators Not Updating

**Symptoms:**
- Sessions don't show green dot when AI is responding
- Dots don't turn gray when AI completes

**Check:**
1. Is SSE connection working? (check widget status)
2. Are `session.status` events being received?
3. Check store subscription in `useSessionStatuses` hook

**Fix:**
- Verify SSE events are reaching the Zustand store
- Check that `handleSSEEvent` in store is processing `session.status` events
- Verify cooldown timer isn't stuck

## Files Modified

- `packages/react/src/factory.ts` - SSR guard, `useConnectionStatus` hook
- `apps/web/src/app/hooks.ts` - Export `useConnectionStatus`
- `apps/web/src/app/projects-list.tsx` - Updated SSEStatus widget
- `apps/web/src/components/sse-debug-panel.tsx` - New debug panel component

## Related Documentation

- `docs/investigations/ssr-usessesync-error-2025-12-31.md` - SSR issue analysis
- `AGENTS.md` - SSE architecture overview
- `packages/core/src/sse/multi-server-sse.ts` - MultiServerSSE implementation

## Success Criteria

✅ Widget shows correct color based on connection state  
✅ Debug panel opens and shows server list  
✅ Recent events appear in debug panel  
✅ No SSR errors on page refresh  
✅ Live session indicators work (green when streaming)  
✅ TypeScript check passes  
✅ No console errors during normal operation
