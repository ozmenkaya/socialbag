import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class MediaFolderCreateTool implements AgentToolInterface {
  constructor(private _mediaService: MediaService) {}
  name = 'mediaFolderCreateTool';

  run() {
    return createTool({
      id: 'mediaFolderCreateTool',
      description: `Create a folder in the media library, optionally inside another folder (parentId from mediaFoldersListTool).
Check mediaFoldersListTool first so you do not create a folder that already exists.`,
      inputSchema: z.object({
        name: z.string().min(1).max(100).describe('Folder name'),
        parentId: z
          .string()
          .optional()
          .describe('Id of the folder to create it in, omit for the top level'),
      }),
      mcp: {
        annotations: {
          title: 'Create Media Folder',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        id: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          return await this._mediaService.createFolder(organizationId, {
            name: inputData.name,
            parentId: inputData.parentId,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
