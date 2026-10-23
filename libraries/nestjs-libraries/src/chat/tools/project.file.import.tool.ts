import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class ProjectFileImportTool implements AgentToolInterface {
  constructor(private _projectsService: ProjectsService) {}
  name = 'projectFileImportTool';

  run() {
    return createTool({
      id: 'projectFileImportTool',
      description: `Copy a photo or a video of a project's Drive folders (projectFilesListTool) into the media library, so it can be attached to a post or used as a reference of generateImageTool (with the returned media id).
A file is copied once, importing it again returns the same media. Photos are scaled down to 2560px JPEG.`,
      inputSchema: z.object({
        fileId: z.string().describe('Id from projectFilesListTool'),
        folderId: z
          .string()
          .optional()
          .describe('Media folder (mediaFoldersListTool) to put it in'),
      }),
      mcp: {
        annotations: {
          title: 'Import Project File',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({
        id: z.string().optional(),
        path: z.string().optional(),
        name: z.string().nullable().optional(),
        error: z.string().optional(),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          return await this._projectsService.importFile(
            organizationId,
            inputData.fileId,
            inputData.folderId
          );
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
    });
  }
}
