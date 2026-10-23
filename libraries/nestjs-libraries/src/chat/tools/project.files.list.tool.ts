import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

const file = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  mimeType: z.string(),
  kind: z.string(),
  size: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  durationMs: z.number().nullable(),
  webUrl: z.string(),
  mediaId: z.string().nullable(),
});

@Injectable()
export class ProjectFilesListTool implements AgentToolInterface {
  constructor(private _projectsService: ProjectsService) {}
  name = 'projectFilesListTool';

  run() {
    return createTool({
      id: 'projectFilesListTool',
      description: `List the raw material of a project (projectsListTool): the photos, videos, floor plans and documents found in its Google Drive folders, 100 per page.
path is the folder inside Drive ("Exterior / Drone"), which often tells what the file shows. Look at a file with projectFileViewTool, and import it with projectFileImportTool before using it in a post or a design (mediaId is set once imported).`,
      inputSchema: z.object({
        projectId: z.string(),
        kind: z.enum(['image', 'video', 'document', 'other']).optional(),
        search: z.string().optional().describe('Part of the file name or folder path'),
        page: z.number().optional().describe('Starts at 0'),
      }),
      mcp: {
        annotations: {
          title: 'List Project Files',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      outputSchema: z.object({
        total: z.number().optional(),
        pages: z.number().optional(),
        files: z.array(file).optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          const { total, pages, files } = await this._projectsService.getFiles(
            organizationId,
            inputData.projectId,
            inputData
          );
          return {
            total,
            pages,
            files: files.map(({ modifiedAt, analyzedAt, ...p }) => p),
          };
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
