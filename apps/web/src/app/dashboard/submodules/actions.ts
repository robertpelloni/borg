'use server';

import { getSubmodules, SubmoduleInfo } from '@/lib/git';
import path from 'path';

// Hardcoded workspace root for now - ideally passed via env or config
// Since this ends up running in the Next.js server, we need to know where the repo root is relative to CWD.
// CWD is usually apps/web or workspace root depending on how it's started.
// We'll assume process.cwd() is .../apps/web, so we go up two levels.

export async function fetchSubmodulesAction(): Promise<SubmoduleInfo[]> {
    const root = path.resolve(process.cwd(), '../../');
    // Safety check: ensure .gitmodules exists here
    console.log("Scanning submodules in:", root);
    return await getSubmodules(root);
}
