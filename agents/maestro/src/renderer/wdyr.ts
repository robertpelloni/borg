/**
 * why-did-you-render setup for development performance profiling
 *
 * This file MUST be imported before React in main.tsx.
 * It only runs in development mode - no impact on production builds.
 *
 * To track a specific component, add this to the component file:
 *   MyComponent.whyDidYouRender = true;
 *
 * Or track all pure components by setting trackAllPureComponents: true below.
 *
 * Output appears in the browser DevTools console showing:
 * - Which components re-rendered
 * - What props/state changes triggered the re-render
 * - Whether the re-render was necessary
 */

// Empty file in production - all wdyr code is in wdyr.dev.ts
// This prevents the library from being bundled in production
export {};
