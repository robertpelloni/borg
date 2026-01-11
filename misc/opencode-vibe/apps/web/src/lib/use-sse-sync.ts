/**
 * Effect Dependency Audit Results - useOpencodeStore Pattern
 *
 * AUDIT DATE: 2026-01-01
 * AUDITOR: WildStar (Swarm Agent)
 * CELL: opencode-next--xts0a-mjvxl9iz6xo
 *
 * ## FINDINGS SUMMARY
 *
 * ✅ NO INFINITE LOOP BUGS FOUND
 *
 * All instances of useOpencodeStore in useEffect dependency arrays follow
 * the correct pattern of using getState() or subscribe() API directly.
 *
 * ## AUDITED FILES
 *
 * ### 1. apps/web/src/app/session/[id]/session-messages.tsx
 *
 * **Location:** Line 288-296
 * **Pattern:** ✅ CORRECT
 * ```typescript
 * useEffect(() => {
 *   if (!directory) return
 *   if (initialStoreMessages.length === 0) return
 *
 *   // Hydrate messages and parts into store
 *   useOpencodeStore
 *     .getState()
 *     .hydrateMessages(directory, sessionId, initialStoreMessages, initialStoreParts)
 * }, [directory, sessionId, initialStoreMessages, initialStoreParts])
 * ```
 *
 * **Analysis:**
 * - Uses `useOpencodeStore.getState()` (static method, stable reference)
 * - NOT in dependency array
 * - Dependencies are only primitive values (strings, arrays)
 * - No infinite loop risk
 *
 * ### 2. packages/react/src/hooks/use-multi-directory-status.ts
 *
 * **Location:** Line 169-268
 * **Pattern:** ✅ CORRECT
 * ```typescript
 * useEffect(() => {
 *   const directorySet = new Set(directories)
 *
 *   const unsubscribe = useOpencodeStore.subscribe((state) => {
 *     // ... subscription logic
 *   })
 *
 *   return unsubscribe
 * }, [directories, sessionStatuses])
 * ```
 *
 * **Analysis:**
 * - Uses `useOpencodeStore.subscribe()` (Zustand API, stable reference)
 * - NOT in dependency array (only directories and sessionStatuses)
 * - subscribe() is a stable method reference
 * - No infinite loop risk
 *
 * **Note:** Line 268 has `sessionStatuses` in dependencies, which is local state.
 * This is intentional - it re-subscribes when sessionStatuses changes to ensure
 * cooldown logic has latest status values for comparison.
 *
 * ### 3. packages/react/src/hooks/use-multi-directory-sessions.ts
 *
 * **Location:** Line 46-113
 * **Pattern:** ✅ CORRECT
 * ```typescript
 * useEffect(() => {
 *   const directorySet = new Set(directories)
 *
 *   const extractSessions = (
 *     state: ReturnType<typeof useOpencodeStore.getState>,
 *   ): Record<string, SessionDisplay[]> => {
 *     // ... extraction logic
 *   }
 *
 *   // Read initial state
 *   const initialSessions = extractSessions(useOpencodeStore.getState())
 *   setLiveSessions(initialSessions)
 *
 *   // Subscribe to future updates
 *   const unsubscribe = useOpencodeStore.subscribe((state) => {
 *     const updated = extractSessions(state)
 *     setLiveSessions(updated)
 *   })
 *
 *   return unsubscribe
 * }, [directories])
 * ```
 *
 * **Analysis:**
 * - Uses `useOpencodeStore.getState()` for initial read (static method)
 * - Uses `useOpencodeStore.subscribe()` for updates (Zustand API)
 * - Neither in dependency array (only directories)
 * - No infinite loop risk
 *
 * ## THE CORRECT PATTERN
 *
 * ### ✅ DO: Use getState() for actions inside effects
 * ```typescript
 * useEffect(() => {
 *   useOpencodeStore.getState().initDirectory(directory)
 * }, [directory])
 * ```
 *
 * ### ✅ DO: Use subscribe() for Zustand subscriptions
 * ```typescript
 * useEffect(() => {
 *   const unsubscribe = useOpencodeStore.subscribe((state) => {
 *     // handle state changes
 *   })
 *   return unsubscribe
 * }, [dependencies])
 * ```
 *
 * ### ❌ DON'T: Put hook return value in dependencies
 * ```typescript
 * // BAD - causes infinite loops
 * const store = useOpencodeStore()
 * useEffect(() => {
 *   store.initDirectory(directory)
 * }, [directory, store]) // ❌ store changes every render!
 * ```
 *
 * ## WHY THIS MATTERS
 *
 * The `useOpencodeStore()` hook returns a NEW REFERENCE on every render:
 *
 * ```typescript
 * // Render 1
 * const store1 = useOpencodeStore() // Object A
 *
 * // Render 2 (even if state unchanged)
 * const store2 = useOpencodeStore() // Object B (different reference!)
 *
 * store1 === store2 // false (always)
 * ```
 *
 * If store is in useEffect dependencies:
 * 1. Component renders
 * 2. useOpencodeStore() returns new reference
 * 3. useEffect sees dependency changed
 * 4. Effect runs
 * 5. Effect might trigger state update
 * 6. Component re-renders
 * 7. GOTO 2 (infinite loop!)
 *
 * ## RECOMMENDATIONS
 *
 * 1. **Keep following the current pattern** - all code is correct
 * 2. **Add ESLint rule** to catch this pattern in future code reviews:
 *    - Warn if `useOpencodeStore()` return value is in dependency array
 *    - Suggest `getState()` or `subscribe()` instead
 * 3. **Document in AGENTS.md** - this audit confirms the pattern works
 * 4. **Test coverage** - see use-sse-sync.test.ts for stability verification
 *
 * ## VERIFICATION
 *
 * Search commands used:
 * ```bash
 * # Find all useOpencodeStore usage
 * rg "useOpencodeStore" apps/web/src packages/react/src/hooks
 *
 * # Find useEffect + useOpencodeStore patterns
 * rg -A 3 "useEffect\(" packages/react/src/hooks --type ts | grep -B 3 "useOpencodeStore"
 * ```
 *
 * Total instances audited: 3
 * Infinite loop bugs found: 0
 * Instances requiring fixes: 0
 *
 * ## CONCLUSION
 *
 * The codebase follows the correct pattern consistently. The gotcha documented
 * in AGENTS.md has been successfully avoided in all production code.
 */

export const AUDIT_COMPLETE = true
