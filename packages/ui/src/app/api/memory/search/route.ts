import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Mock results
  const results = [
    { 
      id: '1', 
      content: `Simulated result for "${query}": User prefers strict type checking.`, 
      tags: ['preference', 'typescript'], 
      timestamp: Date.now(), 
      sourceProvider: 'default-file' 
    },
    { 
      id: '2', 
      content: `Simulated result for "${query}": Previous session analyzed architecture patterns.`, 
      tags: ['fact', 'history'], 
      timestamp: Date.now() - 86400000, 
      sourceProvider: 'mem0' 
    }
  ];

  return NextResponse.json(results);
}
