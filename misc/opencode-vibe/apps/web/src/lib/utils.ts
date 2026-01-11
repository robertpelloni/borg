import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with proper precedence
 *
 * Combines clsx for conditional classes and tailwind-merge for
 * handling Tailwind conflicts (e.g., "p-2 p-4" → "p-4")
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Effect Dependency Pattern - useOpencodeStore
 *
 * AUDIT RESULTS (2026-01-01): All instances follow correct pattern.
 * See use-sse-sync.ts for detailed audit documentation.
 * See use-sse-sync.test.ts for stability verification tests.
 *
 * ✅ CORRECT PATTERN: Use getState() or subscribe() API
 * ❌ WRONG PATTERN: Put hook return value in dependency array
 *
 * Examples:
 *
 * ✅ DO: getState() for actions
 * ```typescript
 * useEffect(() => {
 *   useOpencodeStore.getState().initDirectory(directory)
 * }, [directory])
 * ```
 *
 * ✅ DO: subscribe() for subscriptions
 * ```typescript
 * useEffect(() => {
 *   const unsubscribe = useOpencodeStore.subscribe((state) => {
 *     // handle state changes
 *   })
 *   return unsubscribe
 * }, [dependencies])
 * ```
 *
 * ❌ DON'T: Put hook in dependencies
 * ```typescript
 * const store = useOpencodeStore()
 * useEffect(() => {
 *   store.initDirectory(directory)
 * }, [directory, store]) // ❌ Unnecessary, adds subscription overhead
 * ```
 */
