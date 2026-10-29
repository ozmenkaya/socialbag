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
export class ApprovalRequestTool implements AgentToolInterface {
  constructor(
    private _approvalsService: ApprovalsService,
    private _postsService: PostsService
  ) {}
  name = 'approvalRequestTool';

  run() {
    return createTool({
      id: 'approvalRequestTool',
      description: `Send posts to the customer for approval on WhatsApp before they are published.
Create the posts first (integrationSchedulePostTool, as drafts or scheduled with the date they should go out) and pass their ids here: one approval covers the posts of all the channels the design goes to.
The posts are held as drafts until the customer answers, a scheduled post is turned into a draft. Once the customer approves on the approval page the posts are scheduled for their date (right away when the date already passed); when the customer asks for a revision the posts stay drafts and the note can be read with approvalStatusTool.
The result has whatsappUrl: give it to the user as a clickable link, it opens WhatsApp with the message and the approval link written, the user only presses Send. The number is the project's approval WhatsApp number (Projects page) unless phone is passed; without any number WhatsApp asks whom to send it to.
A new approval for the same posts replaces the older link.`,
      inputSchema: z.object({
        postIds: z
          .array(z.string())
          .min(1)
          .describe('The "postId" of the main post on each channel'),
        projectId: z
          .string()
          .optional()
          .describe('The project of the design (projectsListTool), its name goes in the message and its approval number is used'),
        phone: z
          .string()
          .optional()
          .describe("The customer's WhatsApp number when it is not the one of the project"),
        message: z
          .string()
          .optional()
          .describe('A message of your own in place of the default one, the approval link is added under it'),
      }),
      mcp: {
        annotations: {
          title: 'Request Customer Approval',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        output: z
          .object({
            approvalId: z.string(),
            link: z.string().describe('The approval page the customer opens'),
            phone: z.string().nullable(),
            whatsappUrl: z.string(),
            message: z.string(),
          })
          .or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        for (const id of inputData.postIds) {
          const [post] = await this._postsService.getPostsRecursively(
            id,
            false,
            organizationId,
            true
          );
          if (post && !isIntegrationAllowed(post.integrationId)) {
            return {
              output: { errors: 'This access key has no access to this channel' },
            };
          }
        }

        try {
          return {
            output: await this._approvalsService.requestApproval(
              organizationId,
              inputData
            ),
          };
        } catch (err: any) {
          return { output: { errors: err?.message || 'Could not send for approval' } };
        }
      },
    });
  }
}
