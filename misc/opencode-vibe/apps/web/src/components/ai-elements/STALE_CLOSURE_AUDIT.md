# Stale Closure Audit - Input/Action Components

## Summary

Audited `apps/web/src/components/ai-elements/` for stale closures in input and action components.

**Files Modified:**
- `suggestion.tsx` - Fixed stale closure in handleClick
- `conversation.tsx` - Optimized handleScroll to use ref pattern

**Tests Added:**
- `suggestion.test.tsx` - Documents inline handler fix
- `conversation.test.tsx` - Documents ref pattern for frequently-changing values

## Issues Found & Fixed

### 1. suggestion.tsx - Stale Closure in handleClick

**Problem:**
```typescript
const handleClick = () => {
  onClick?.(suggestion)
}
```
Captured `onClick` and `suggestion` props without `useCallback`. If parent re-rendered with new props, handler stayed stale.

**Fix:**
```typescript
// Inline handler - React recreates on each render, ensures fresh props
<Button onClick={() => onClick?.(suggestion)} />
```

**Why inline is correct here:**
- Simple prop forwarding
- No performance concern (button clicks are infrequent)
- React handles freshness automatically

---

### 2. conversation.tsx - Unnecessary Callback Recreation

**Problem:**
```typescript
const handleScroll = useCallback(() => {
  // ... uses isSticking
}, [isSticking])
```
Every `isSticking` change recreated `handleScroll`, causing `onScroll` prop to change.

**Fix:**
```typescript
const isStickingRef = useRef(isSticking)
isStickingRef.current = isSticking // Update on every render

const handleScroll = useCallback(() => {
  // ... uses isStickingRef.current
}, []) // Empty deps - callback never recreated
```

**Benefits:**
- Callback function stays stable
- `onScroll` prop doesn't change
- Avoids unnecessary re-renders of scroll container

---

## Safe Patterns Verified

✅ **Inline handlers calling props with no arguments:**
```typescript
onClick={(e) => { 
  e.stopPropagation(); 
  onRemove() 
}}
```

✅ **Inline handlers with local state:**
```typescript
onClick={() => setIsOpen(!isOpen)}
```

✅ **Inline handlers with stable context + loop iteration:**
```typescript
onClick={() => attachments.remove(data.id)}
```

---

## Testing Approach

**Following project convention:** NO DOM TESTING.

Tests verify handler logic directly without rendering:
- `suggestion.test.tsx` - Simulates handler creation with captured props
- `conversation.test.tsx` - Simulates useCallback behavior with/without deps

All tests pass (117 tests total in ai-elements).

---

## Rules

1. **Inline handlers for simple prop forwarding** - React handles freshness
2. **useCallback with ref pattern** - When value changes frequently but doesn't need to trigger callback recreation
3. **useCallback with deps** - When callback needs to be recreated on specific changes

**Ref pattern:** Use when value changes often but callback stability matters more than immediate reactivity.
