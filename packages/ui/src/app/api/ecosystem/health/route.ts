import { NextRequest, NextResponse } from 'next/server';
import type { SubmoduleHealth, HealthStatus } from '@/types/submodule';

export async function POST(request: NextRequest) {
  try {
    const { names } = await request.json();
    
    if (!Array.isArray(names)) {
      return NextResponse.json({ error: 'names must be an array' }, { status: 400 });
    }

    const coreApiUrl = process.env.CORE_API_URL || 'http://localhost:3002';
    
    try {
      const response = await fetch(`${coreApiUrl}/api/submodules/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
    }

    const health: SubmoduleHealth[] = names.map((name: string) => ({
      name,
      status: 'unknown' as HealthStatus,
      lastCheck: new Date().toISOString()
    }));

    return NextResponse.json({ health });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
