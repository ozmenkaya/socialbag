import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaAutoPostService } from '@gitroom/nestjs-libraries/database/prisma/media/media.autopost.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class MediaMoveTool implements AgentToolInterface {
  constructor(private _mediaAutoPostService: MediaAutoPostService) {}
  name = 'mediaMoveTool';

  run() {
    return createTool({
      id: 'mediaMoveTool',
      description: `Move media of the library into a folder, or out of every folder (folderId null).
If the target folder has auto post enabled (see mediaFoldersListTool), the moved media are added as drafts on the folder's channels.`,
      inputSchema: z.object({
        mediaIds: z.array(z.string()).min(1).describe('Ids from mediaListTool'),
        folderId: z
          .string()
          .nullable()
          .describe('Target folder id from mediaFoldersListTool, null for no folder'),
      }),
      mcp: {
        annotations: {
          title: 'Move Media',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        count: z.number().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          return await this._mediaAutoPostService.moveMedia(organizationId, {
            media: inputData.mediaIds,
            folderId: inputData.folderId,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
