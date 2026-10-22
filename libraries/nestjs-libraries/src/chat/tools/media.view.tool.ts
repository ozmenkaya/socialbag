import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

const details = z.object({
  id: z.string(),
  originalName: z.string().nullable(),
  path: z.string(),
  folderId: z.string().nullable(),
  isVideo: z.boolean(),
});

@Injectable()
export class MediaViewTool implements AgentToolInterface {
  constructor(private _mediaService: MediaService) {}
  name = 'mediaViewTool';

  run() {
    return createTool({
      id: 'mediaViewTool',
      description: `Look at a media of the library: returns the picture itself (a video returns its thumbnail), scaled down.
Use it to pick which photos fit a design before passing them to generateImageTool as references, and to check a generated design.`,
      inputSchema: z.object({
        mediaId: z.string().describe('Id from mediaListTool'),
      }),
      mcp: {
        annotations: {
          title: 'View Media',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      // structuredContent carries the details, content the picture itself:
      // the MCP server sends an author supplied content array as is
      outputSchema: details.partial().extend({
        error: z.string().optional(),
        structuredContent: details.partial().optional(),
        content: z.array(z.any()).optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          const { data, ...media } = await this._mediaService.getMediaPreview(
            organizationId,
            inputData.mediaId
          );

          return {
            structuredContent: media,
            content: [
              { type: 'image', data, mimeType: 'image/jpeg' },
              { type: 'text', text: JSON.stringify(media) },
            ],
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
