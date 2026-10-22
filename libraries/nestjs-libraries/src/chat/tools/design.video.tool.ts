import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class DesignVideoTool implements AgentToolInterface {
  constructor(private _mediaService: MediaService) {}
  name = 'designVideoTool';

  run() {
    return createTool({
      id: 'designVideoTool',
      description: `Start an AI video from a prompt, optionally animating one of the user's photos (startFrameMediaId from mediaListTool, look at it with mediaViewTool first).
Videos take a few minutes and cost much more than images: confirm duration and resolution with the user. Returns a jobId, then call designVideoStatusTool until it is completed; that call saves the video in the media library.`,
      inputSchema: z.object({
        prompt: z.string().min(1).max(6000).describe('What happens in the video, camera moves included'),
        startFrameMediaId: z.string().optional().describe('Photo the video starts from'),
        size: z
          .enum(['square', 'portrait', 'story', 'landscape'])
          .optional()
          .describe('square 1:1, portrait 4:5, story 9:16 (stories, reels), landscape 16:9'),
        duration: z.enum(['5s', '10s']).optional(),
        resolution: z.enum(['540p', '720p', '1080p']).optional(),
      }),
      mcp: {
        annotations: {
          title: 'Design Video',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({
        jobId: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          return await this._mediaService.startDesignVideo(organizationId, {
            prompt: inputData.prompt,
            size: inputData.size || 'story',
            duration: inputData.duration || '5s',
            resolution: inputData.resolution || '720p',
            startFrameId: inputData.startFrameMediaId,
          });
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
