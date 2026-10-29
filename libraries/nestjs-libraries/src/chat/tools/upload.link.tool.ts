import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

// The upload widget without the widget: for an agent holding the file in its
// own workspace (a design it rendered), with no public URL and no device of
// the user to pick it from. The ticket is short-lived and only uploads to the
// caller's own organization
@Injectable()
export class UploadLinkTool implements AgentToolInterface {
  constructor(private _mediaService: MediaService) {}
  name = 'uploadLinkTool';
  mcpOnly = true;

  run() {
    return createTool({
      id: 'uploadLinkTool',
      description: `Get a short-lived upload link to send a file you have in your own workspace (for example a design you rendered as PNG) straight to the media library, when it has no public URL (uploadFromUrlTool) and is not on the user's device (uploadWidgetTool).
Send the file from your code environment as multipart form data in the field "file", the command is in the result (curl). Each upload returns the media (id, path) to use in posts; several files can be sent with the same link until it expires.
The uploaded media can also be listed with uploadWidgetStatusTool and the sessionId, and moved into a project folder with mediaMoveTool.`,
      mcp: {
        annotations: {
          title: 'Upload Link',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      inputSchema: z.object({}),
      outputSchema: z.object({
        sessionId: z.string().optional(),
        uploadUrl: z.string().optional(),
        expiresInSeconds: z.number().optional(),
        curl: z.string().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        try {
          const org = JSON.parse(
            (context?.requestContext as any)?.get('organization') as string
          );
          const sessionId = await this._mediaService.createUploadSession(
            org.id
          );
          const ticket = await this._mediaService.createUploadTicket(
            org.id,
            sessionId
          );
          const uploadUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/media-widget/upload?ticket=${ticket}`;
          return {
            sessionId,
            uploadUrl,
            expiresInSeconds: 600,
            curl: `curl -sS -F "file=@/path/to/design.png" "${uploadUrl}"`,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { error: `Failed to create an upload link: ${message}` };
        }
      },
    });
  }
}
