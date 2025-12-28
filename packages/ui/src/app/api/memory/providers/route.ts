import { NextResponse } from 'next/server';

// Mock data until we connect to the real Core API
const MOCK_PROVIDERS = [
  { 
    id: 'default-file', 
    name: 'Local File Storage', 
    type: 'file', 
    capabilities: ['read', 'write', 'search'],
    status: 'connected'
  },
  { 
    id: 'mem0', 
    name: 'Mem0 (Cloud)', 
    type: 'vector', 
    capabilities: ['read', 'write', 'search'],
    status: 'configured'
  },
  { 
    id: 'pinecone', 
    name: 'Pinecone Vector DB', 
    type: 'vector', 
    capabilities: ['read', 'search'],
    status: 'disconnected'
  }
];

export async function GET() {
  // TODO: Fetch from actual Core Hub API
  return NextResponse.json(MOCK_PROVIDERS);
}
