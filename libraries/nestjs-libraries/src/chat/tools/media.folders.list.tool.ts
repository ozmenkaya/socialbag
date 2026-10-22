import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class MediaFoldersListTool implements AgentToolInterface {
  constructor(private _mediaService: MediaService) {}
  name = 'mediaFoldersListTool';

  run() {
    return createTool({
      id: 'mediaFoldersListTool',
      description: `List the folders of the media library (they can be nested through parentId), with the number of media in each, the channels linked to each folder and the folder's auto post schedule.
Use a folder id with mediaListTool to list the media inside it, with mediaMoveTool to put media in it, and with generateImageTool (folderId) to save a design there.`,
      inputSchema: z.object({}),
      mcp: {
        annotations: {
          title: 'List Media Folders',
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
            name: z.string(),
            path: z.string(),
            parentId: z.string().nullable(),
            count: z.number(),
            channels: z.array(
              z.object({ id: z.string(), name: z.string(), platform: z.string() })
            ),
            autoPost: z.object({
              enabled: z.boolean(),
              days: z.array(z.number()),
              time: z.string(),
              timezone: z.string(),
            }),
          })
        ),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const folders = await this._mediaService.getFolders(organizationId);
        const pathOf = (id: string) => {
          const names: string[] = [];
          let current = folders.find((p) => p.id === id);
          while (current) {
            names.unshift(current.name);
            current = folders.find((p) => p.id === current!.parentId);
          }
          return names.join(' / ');
        };

        return {
          output: folders.map((p) => ({
            id: p.id,
            name: p.name,
            path: pathOf(p.id),
            parentId: p.parentId,
            count: p.count,
            channels: p.integrations.map((i) => ({
              id: i.id,
              name: i.name,
              platform: i.providerIdentifier,
            })),
            autoPost: {
              enabled: p.autoPost.enabled,
              days: p.autoPost.days,
              time: p.autoPost.time,
              timezone: p.autoPost.timezone,
            },
          })),
        };
      },
    });
  }
}
