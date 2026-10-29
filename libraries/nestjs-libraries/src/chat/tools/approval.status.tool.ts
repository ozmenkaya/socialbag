import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { ApprovalsService } from '@gitroom/nestjs-libraries/database/prisma/approvals/approvals.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  checkAuth,
  isIntegrationAllowed,
} from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class ApprovalStatusTool implements AgentToolInterface {
  constructor(
    private _approvalsService: ApprovalsService,
    private _postsService: PostsService
  ) {}
  name = 'approvalStatusTool';

  run() {
    return createTool({
      id: 'approvalStatusTool',
      description: `List the designs sent to customers for approval (approvalRequestTool), newest first, with their answer.
status is pending (no answer yet), approved (the posts were scheduled), revision (the customer asked for changes, written in note: redo the design, update the post and send it for approval again) or replaced (a newer link was sent for the same posts).`,
      inputSchema: z.object({
        status: z
          .enum(['pending', 'approved', 'revision', 'replaced'])
          .optional(),
        postId: z.string().optional().describe('Only the approvals of this post'),
      }),
      mcp: {
        annotations: {
          title: 'Approval Status',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z.array(
          z.object({
            approvalId: z.string(),
            status: z.string(),
            note: z.string().nullable(),
            postIds: z.array(z.string()),
            projectId: z.string().nullable(),
            phone: z.string().nullable(),
            link: z.string(),
            createdAt: z.string(),
            respondedAt: z.string().nullable(),
          })
        ),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const list = await this._approvalsService.getApprovals(
          organizationId,
          inputData.status,
          inputData.postId
        );
        // an access key limited to some channels only sees their approvals
        const allowed = [];
        for (const approval of list) {
          let all = true;
          for (const id of approval.postIds) {
            const [post] = await this._postsService.getPostsRecursively(
              id,
              false,
              organizationId,
              true
            );
            if (post && !isIntegrationAllowed(post.integrationId)) {
              all = false;
            }
          }
          if (all) {
            allowed.push(approval);
          }
        }

        return {
          output: allowed.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            respondedAt: p.respondedAt ? p.respondedAt.toISOString() : null,
          })),
        };
      },
    });
  }
}
