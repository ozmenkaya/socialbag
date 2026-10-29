import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { RequestsService } from '@gitroom/nestjs-libraries/database/prisma/requests/requests.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class ProjectRequestsListTool implements AgentToolInterface {
  constructor(private _requestsService: RequestsService) {}
  name = 'projectRequestsListTool';

  run() {
    return createTool({
      id: 'projectRequestsListTool',
      description: `List what the customers asked for from the customer portal, newest first: a post or design they want (title, description, the date they want it on) with the photos and videos they attached (media of the library, use their path in designs and posts).
status is new (nobody looked at it yet), in_progress or done. Once you start on a request set it in_progress with projectRequestUpdateTool, and done with a reply for the customer when the design is sent for approval (approvalRequestTool).`,
      inputSchema: z.object({
        status: z.enum(['new', 'in_progress', 'done']).optional(),
        projectId: z.string().optional().describe('Only the requests of this project (projectsListTool)'),
      }),
      mcp: {
        annotations: {
          title: 'Customer Requests',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.array(
          z.object({
            id: z.string(),
            projectId: z.string(),
            projectName: z.string(),
            clientName: z.string(),
            title: z.string(),
            description: z.string(),
            wantedDate: z.string().nullable(),
            status: z.string(),
            reply: z.string().nullable(),
            createdAt: z.string(),
            media: z.array(z.object({ id: z.string(), path: z.string() })),
          })
        ),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const list = await this._requestsService.getRequests(organizationId, {
          status: inputData.status,
          projectIds: inputData.projectId ? [inputData.projectId] : undefined,
          take: 50,
        });
        return {
          output: list.map((p) => ({
            id: p.id,
            projectId: p.projectId,
            projectName: p.projectName,
            clientName: p.clientName,
            title: p.title,
            description: p.description,
            wantedDate: p.wantedDate ? p.wantedDate.toISOString() : null,
            status: p.status,
            reply: p.reply,
            createdAt: p.createdAt.toISOString(),
            media: p.media.map((m) => ({ id: m.id, path: m.path })),
          })),
        };
      },
    });
  }
}
