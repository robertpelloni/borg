import { NextResponse } from 'next/server';

const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:3002';

export async function GET() {
  try {
    const res = await fetch(`${CORE_API_URL}/api/memory/providers`);
    if (!res.ok) {
        throw new Error(`Core API error: ${res.statusText}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
