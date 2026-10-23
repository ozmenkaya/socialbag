import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import z from 'zod';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';

@Injectable()
export class ProjectsListTool implements AgentToolInterface {
  constructor(private _projectsService: ProjectsService) {}
  name = 'projectsListTool';

  run() {
    return createTool({
      id: 'projectsListTool',
      description: `List the projects of this customer (the organization), each with its description, the channels posting for it, its media folders and the Google Drive folders holding its raw material.
When the user talks about a project, use its channels and its folders (mediaListTool with the folder id) for the posts and designs of that project.`,
      inputSchema: z.object({}),
      mcp: {
        annotations: {
          title: 'List Projects',
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
            description: z.string(),
            channels: z.array(
              z.object({ id: z.string(), name: z.string(), platform: z.string() })
            ),
            folders: z.array(z.object({ id: z.string(), name: z.string() })),
            driveFolders: z.array(z.string()),
          })
        ),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        const projects = await this._projectsService.getProjects(organizationId);
        return {
          output: projects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            channels: p.integrations.map((i) => ({
              id: i.id,
              name: i.name,
              platform: i.providerIdentifier,
            })),
            folders: p.folders,
            driveFolders: p.sources.map((s) => s.url),
          })),
        };
      },
    });
  }
}
