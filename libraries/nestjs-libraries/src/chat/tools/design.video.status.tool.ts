import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { MediaAutoPostService } from '@gitroom/nestjs-libraries/database/prisma/media/media.autopost.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class DesignVideoStatusTool implements AgentToolInterface {
  constructor(
    private _mediaService: MediaService,
    private _mediaAutoPostService: MediaAutoPostService
  ) {}
  name = 'designVideoStatusTool';

  run() {
    return createTool({
      id: 'designVideoStatusTool',
      description: `Check a video started with designVideoTool. While it is queued or processing, wait about 30 seconds and call again.
Once completed, the video is saved in the media library (and in folderId if given) and its id and path are returned.`,
      inputSchema: z.object({
        jobId: z.string(),
        folderId: z
          .string()
          .optional()
          .describe('Folder id (mediaFoldersListTool) to save the finished video in'),
      }),
      mcp: {
        annotations: {
          title: 'Design Video Status',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({
        state: z.string().optional(),
        id: z.string().optional(),
        path: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          const result = await this._mediaService.finishDesignVideo(
            organizationId,
            inputData.jobId
          );
          if (result.state !== 'completed' || !('media' in result)) {
            return { state: result.state, ...('error' in result ? { error: result.error } : {}) };
          }

          if (inputData.folderId && 'created' in result) {
            await this._mediaAutoPostService.moveMedia(organizationId, {
              media: [result.media.id],
              folderId: inputData.folderId,
            });
          }

          return { state: 'completed', id: result.media.id, path: result.media.path };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
