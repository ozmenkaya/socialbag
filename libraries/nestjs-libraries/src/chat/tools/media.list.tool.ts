import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class MediaListTool implements AgentToolInterface {
  constructor(private _mediaService: MediaService) {}
  name = 'mediaListTool';

  run() {
    return createTool({
      id: 'mediaListTool',
      description: `List the media (images and videos) already uploaded to the media library, newest first, 18 per page, optionally searched by original filename and limited to one folder.
Use the returned path as an attachment URL in integrationSchedulePostTool instead of uploading the file again. Use mediaViewTool to look at a media.`,
      inputSchema: z.object({
        search: z
          .string()
          .optional()
          .describe('Filter by original filename (case-insensitive contains)'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Page number, starting at 1'),
        folder: z
          .string()
          .optional()
          .describe(
            "Folder id from mediaFoldersListTool to list only its media, 'root' for media outside folders, omit for all media"
          ),
      }),
      mcp: {
        annotations: {
          title: 'List Media',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        pages: z.number(),
        output: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            originalName: z.string().nullable(),
            path: z.string(),
            folderId: z.string().nullable(),
            createdAt: z.string(),
          })
        ),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const { pages, results } = await this._mediaService.getMedia(
          organizationId,
          inputData.page || 1,
          inputData.search,
          inputData.folder
        );

        return {
          pages,
          output: results.map((p) => ({
            id: p.id,
            name: p.name,
            originalName: p.originalName,
            path: p.path,
            folderId: p.folderId,
            createdAt: p.createdAt.toISOString(),
          })),
        };
      },
    });
  }
}
