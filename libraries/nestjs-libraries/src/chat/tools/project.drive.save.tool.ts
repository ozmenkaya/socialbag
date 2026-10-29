import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class ProjectDriveSaveTool implements AgentToolInterface {
  constructor(private _projectsService: ProjectsService) {}
  name = 'projectDriveSaveTool';

  run() {
    return createTool({
      id: 'projectDriveSaveTool',
      description: `Save designs (media of the library, mediaListTool) into the Google Drive folder of a project (projectsListTool), in its "Socialbag Tasarımlar" folder, so the customer keeps them in their archive.
The files are saved under the name they have in the library; a design saved again is not copied twice, a revised one with the same name is added next to it. The designs folder is left out of the project's raw material (projectFilesListTool).
The project's first Drive folder is used unless driveFolder (the link of one of its Drive folders) is passed.`,
      inputSchema: z.object({
        projectId: z.string(),
        mediaIds: z.array(z.string()).min(1).max(50),
        driveFolder: z
          .string()
          .optional()
          .describe('Link of one of the Drive folders of the project'),
      }),
      mcp: {
        annotations: {
          title: 'Save Designs To Project Drive',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({
        output: z
          .array(
            z.object({
              mediaId: z.string(),
              url: z.string().optional().describe('The file in Drive'),
              folderUrl: z.string().optional(),
              existed: z.boolean().optional().describe('It was already saved'),
              error: z.string().optional(),
            })
          )
          .or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        try {
          return {
            output: await this._projectsService.saveToDrive(
              organizationId,
              inputData.projectId,
              inputData.mediaIds,
              inputData.driveFolder
            ),
          };
        } catch (err) {
          return {
            output: { errors: err instanceof Error ? err.message : String(err) },
          };
        }
      },
    });
  }
}
