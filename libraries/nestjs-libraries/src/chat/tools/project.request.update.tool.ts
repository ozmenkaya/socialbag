import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { RequestsService } from '@gitroom/nestjs-libraries/database/prisma/requests/requests.service';
import { checkAuth, isIntegrationAllowed } from '@gitroom/nestjs-libraries/chat/auth.context';
import { getScope } from '@gitroom/nestjs-libraries/chat/async.storage';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';

@Injectable()
export class ProjectRequestUpdateTool implements AgentToolInterface {
  constructor(
    private _requestsService: RequestsService,
    private _projectsService: ProjectsService
  ) {}

  // an access key limited to some channels only reaches the projects that
  // post on one of them, undefined when it is not limited
  private async allowedProjects(org: string) {
    if (!getScope()?.integrationIds?.length) {
      return undefined;
    }
    const projects = await this._projectsService.getProjects(org);
    return projects
      .filter((p) => p.integrations.some((i) => isIntegrationAllowed(i.id)))
      .map((p) => p.id);
  }
  name = 'projectRequestUpdateTool';

  run() {
    return createTool({
      id: 'projectRequestUpdateTool',
      description: `Update a customer request (projectRequestsListTool): its status (in_progress while the design is being made, done once it was sent for approval or published) and a short reply the customer reads on the portal, in their language (Turkish), for example "Tasarımınız hazırlandı, onayınıza gönderdik."`,
      inputSchema: z.object({
        requestId: z.string(),
        status: z.enum(['new', 'in_progress', 'done']).optional(),
        reply: z.string().max(2000).optional().describe('Empty removes the reply'),
      }),
      mcp: {
        annotations: {
          title: 'Update Customer Request',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.object({ id: z.string() }).or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          const allowed = await this.allowedProjects(organizationId);
          if (allowed) {
            const [request] = await this._requestsService.getRequests(organizationId, {
              projectIds: allowed,
              requestId: inputData.requestId,
            });
            if (!request) {
              throw new Error('This access key has no access to this request');
            }
          }
          return {
            output: await this._requestsService.updateRequest(organizationId, inputData.requestId, {
              status: inputData.status,
              reply: inputData.reply,
            }),
          };
        } catch (err) {
          return {
            output: { errors: err instanceof Error ? err.message : String(err) },
          };
        }
      },
    });
  }
}
