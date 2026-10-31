import {
  continueAsNew,
  proxyActivities,
  sleep,
  workflowInfo,
} from '@temporalio/workflow';
import { ProjectsActivity } from '@gitroom/orchestrator/activities/projects.activity';

const { syncAllProjects } = proxyActivities<ProjectsActivity>({
  startToCloseTimeout: '10 minute',
  taskQueue: 'main',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 1,
    initialInterval: '2 minutes',
  },
});

export async function driveSyncWorkflow() {
  let loops = 0;
  while (true) {
    try {
      await syncAllProjects();
    } catch (err) {}
    await sleep('1 hour');

    // Keep the history small, the new run syncs immediately so the hourly cadence is kept
    if (++loops >= 24 || workflowInfo().historyLength > 1000) {
      return await continueAsNew<typeof driveSyncWorkflow>();
    }
  }
}
