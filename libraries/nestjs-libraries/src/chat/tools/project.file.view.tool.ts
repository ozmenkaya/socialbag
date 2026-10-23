import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

const details = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  kind: z.string(),
  webUrl: z.string(),
  mediaId: z.string().nullable(),
});

@Injectable()
export class ProjectFileViewTool implements AgentToolInterface {
  constructor(private _projectsService: ProjectsService) {}
  name = 'projectFileViewTool';

  run() {
    return createTool({
      id: 'projectFileViewTool',
      description: `Look at a file of a project's Drive folders (projectFilesListTool): returns the preview Drive renders, scaled down (a video shows a frame, a document its first page).
Use it to tell what a photo shows, read a floor plan, or pick the files of a design.`,
      inputSchema: z.object({
        fileId: z.string().describe('Id from projectFilesListTool'),
      }),
      mcp: {
        annotations: {
          title: 'View Project File',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      // structuredContent carries the details, content the picture itself
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
          const { file, data } = await this._projectsService.getFilePreview(
            organizationId,
            inputData.fileId
          );
          const shown = {
            id: file.id,
            name: file.name,
            path: file.path,
            kind: file.kind,
            webUrl: file.webUrl,
            mediaId: file.mediaId,
          };

          return {
            structuredContent: shown,
            content: [
              { type: 'image', data, mimeType: 'image/jpeg' },
              { type: 'text', text: JSON.stringify(shown) },
            ],
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
