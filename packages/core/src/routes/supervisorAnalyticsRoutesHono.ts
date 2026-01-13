import { Hono } from 'hono';
import { SupervisorCouncilManager, type SupervisorAnalytics } from '../managers/SupervisorCouncilManager.js';

export function createSupervisorAnalyticsRoutes(): Hono {
  const app = new Hono();
  const councilManager = SupervisorCouncilManager.getInstance();

  app.get('/', (c) => {
    const analytics = councilManager.getAnalytics();
    return c.json({ analytics });
  });

  app.get('/supervisor/:name', (c) => {
    const name = c.req.param('name');
    const analytics = councilManager.getSupervisorAnalytics(name);
    
    if (!analytics) {
      return c.json({ error: 'Supervisor not found or no analytics available' }, 404);
    }

    return c.json({ supervisor: name, analytics });
  });

  app.get('/rankings', (c) => {
    const analytics = councilManager.getAnalytics();
    
    const rankings = Object.entries(analytics.supervisorStats)
      .map(([name, data]: [string, SupervisorAnalytics]) => ({
        name,
        totalVotes: data.totalVotes,
        avgConfidence: data.avgConfidence,
        approvalRate: data.approvalRate,
        avgResponseTimeMs: data.avgResponseTimeMs,
      }))
      .sort((a, b) => b.approvalRate - a.approvalRate);

    return c.json({ rankings });
  });

  app.post('/reset', (c) => {
    councilManager.resetAnalytics();
    return c.json({ status: 'reset', message: 'All analytics have been reset' });
  });

  app.post('/reset/:name', (c) => {
    const name = c.req.param('name');
    const analytics = councilManager.getSupervisorAnalytics(name);
    
    if (!analytics) {
      return c.json({ error: 'Supervisor not found' }, 404);
    }

    councilManager.resetAnalytics();
    return c.json({ status: 'reset', supervisor: name });
  });

  app.get('/summary', (c) => {
    const analytics = councilManager.getAnalytics();
    const supervisors = councilManager.getSupervisors();
    
    const supervisorEntries = Object.entries(analytics.supervisorStats) as [string, SupervisorAnalytics][];
    
    const avgConfidenceOverall = supervisorEntries.length > 0
      ? supervisorEntries.reduce((sum, [_, a]) => sum + a.avgConfidence, 0) / supervisorEntries.length
      : 0;

    const sortedByVotes = supervisorEntries
      .sort((a, b) => b[1].totalVotes - a[1].totalVotes);
    const mostActiveSupervisor = sortedByVotes[0];

    const highestApprovalRate = supervisorEntries
      .filter(([_, a]) => a.totalVotes >= 3)
      .sort((a, b) => b[1].approvalRate - a[1].approvalRate)[0];

    return c.json({
      summary: {
        totalSupervisors: supervisors.length,
        totalDebates: analytics.totalDebates,
        totalApproved: analytics.totalApproved,
        totalRejected: analytics.totalRejected,
        avgConsensus: analytics.avgConsensus,
        avgConfidence: Math.round(avgConfidenceOverall * 100) / 100,
        mostActive: mostActiveSupervisor ? { 
          name: mostActiveSupervisor[0], 
          votes: mostActiveSupervisor[1].totalVotes 
        } : null,
        highestApprovalRate: highestApprovalRate ? {
          name: highestApprovalRate[0],
          rate: Math.round(highestApprovalRate[1].approvalRate * 10) / 10,
        } : null,
      },
    });
  });

  app.get('/export', (c) => {
    const analytics = councilManager.getAnalytics();
    const supervisors = councilManager.getSupervisors();
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      supervisorCount: supervisors.length,
      analytics,
      supervisorDetails: supervisors.map(s => ({
        name: s.name,
        provider: s.provider,
      })),
    };

    return c.json(exportData);
  });

  return app;
}
