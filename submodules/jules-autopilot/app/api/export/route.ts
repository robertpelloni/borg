import { NextResponse, NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha';

interface ExportOptions {
  sessionId: string;
  format: 'json' | 'markdown';
  includeActivities?: boolean;
  includeLogs?: boolean;
  includeDebates?: boolean;
}

async function fetchSessionFromJules(sessionId: string, apiKey: string) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch session: ${response.status}`);
  }

  return response.json();
}

async function fetchActivitiesFromJules(sessionId: string, apiKey: string) {
  const response = await fetch(`${JULES_API_BASE}/sessions/${sessionId}/activities`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.status}`);
  }

  const data = await response.json();
  return data.activities || [];
}

async function fetchLogsFromDB(sessionId: string) {
  return prisma.keeperLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}

async function fetchDebatesFromDB(sessionId: string) {
  return prisma.debate.findMany({
    where: {
      metadata: { contains: sessionId },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function formatAsMarkdown(data: {
  session: Record<string, unknown>;
  activities: Record<string, unknown>[];
  logs?: Record<string, unknown>[];
  debates?: Record<string, unknown>[];
}): string {
  const { session, activities, logs, debates } = data;
  const lines: string[] = [];

  lines.push(`# Session Export: ${session.title || session.name || 'Untitled'}`);
  lines.push('');
  lines.push(`**Session ID:** ${session.name || session.id}`);
  lines.push(`**Status:** ${session.state || 'unknown'}`);
  lines.push(`**Created:** ${session.createTime || 'unknown'}`);
  lines.push('');

  if (session.task) {
    lines.push('## Task');
    lines.push('');
    lines.push(String(session.task));
    lines.push('');
  }

  if (activities.length > 0) {
    lines.push('## Activities');
    lines.push('');

    for (const activity of activities) {
      const role = activity.activityType === 'USER_MESSAGE' ? 'User' : 'Agent';
      const time = activity.createTime || '';
      lines.push(`### ${role} (${time})`);
      lines.push('');

      const content = activity.content as string | undefined;
      const agentResponse = activity.agentResponse as { content?: string } | undefined;

      if (content) {
        lines.push(content);
      }

      if (agentResponse?.content) {
        lines.push(agentResponse.content);
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  if (logs && logs.length > 0) {
    lines.push('## Keeper Logs');
    lines.push('');
    lines.push('| Time | Type | Message |');
    lines.push('|------|------|---------|');

    for (const log of logs) {
      const time = log.createdAt ? new Date(String(log.createdAt)).toISOString() : '';
      lines.push(`| ${time} | ${log.type} | ${log.message} |`);
    }
    lines.push('');
  }

  if (debates && debates.length > 0) {
    lines.push('## Debates');
    lines.push('');

    for (const debate of debates) {
      lines.push(`### Debate: ${debate.topic || 'Untitled'}`);
      lines.push(`**Summary:** ${debate.summary || 'None'}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const apiKey = session?.apiKey;

    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const options: ExportOptions = await request.json();

    if (!options.sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const format = options.format || 'json';
    const includeActivities = options.includeActivities !== false;
    const includeLogs = options.includeLogs === true;
    const includeDebates = options.includeDebates === true;

    const [julesSession, activities, logs, debates] = await Promise.all([
      fetchSessionFromJules(options.sessionId, apiKey),
      includeActivities ? fetchActivitiesFromJules(options.sessionId, apiKey) : Promise.resolve([]),
      includeLogs ? fetchLogsFromDB(options.sessionId) : Promise.resolve([]),
      includeDebates ? fetchDebatesFromDB(options.sessionId) : Promise.resolve([]),
    ]);

    const exportData = {
      session: julesSession,
      activities,
      ...(includeLogs && { logs }),
      ...(includeDebates && { debates }),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    if (format === 'markdown') {
      const markdown = formatAsMarkdown(exportData);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="session-${options.sessionId}.md"`,
        },
      });
    }

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('[Export API] Error:', error);
    return NextResponse.json(
      { error: 'Export failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  const format = request.nextUrl.searchParams.get('format') || 'json';

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param required' }, { status: 400 });
  }

  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ sessionId, format }),
  });

  return POST(mockRequest as NextRequest);
}
