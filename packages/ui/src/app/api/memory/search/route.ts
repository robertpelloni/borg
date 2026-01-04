import { NextResponse } from 'next/server';

const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:3002';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const providerId = searchParams.get('providerId');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const coreUrl = new URL(`${CORE_API_URL}/api/memory/search`);
    coreUrl.searchParams.append('query', query);
    if (providerId) coreUrl.searchParams.append('providerId', providerId);

    const res = await fetch(coreUrl.toString());
    if (!res.ok) {
        throw new Error(`Core API error: ${res.statusText}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
