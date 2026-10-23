import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectsRepository } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.repository';
import { ProjectDto } from '@gitroom/nestjs-libraries/dtos/projects/project.dto';

// https://drive.google.com/drive/folders/<id>, .../drive/u/0/folders/<id>,
// open?id=<id> or the id alone
const driveFolderId = (value: string) => {
  const text = value.trim();
  const id =
    text.match(/\/folders\/([A-Za-z0-9_-]{10,})/)?.[1] ||
    text.match(/[?&]id=([A-Za-z0-9_-]{10,})/)?.[1] ||
    text.match(/^([A-Za-z0-9_-]{10,})$/)?.[1];
  if (!id) {
    throw new BadRequestException(`Not a Google Drive folder link: ${text.slice(0, 100)}`);
  }

  return id;
};

@Injectable()
export class ProjectsService {
  constructor(private _projectsRepository: ProjectsRepository) {}

  async getProjects(org: string) {
    const projects = await this._projectsRepository.getProjects(org);
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      integrations: project.integrations.map((p) => p.integration),
      folders: project.folders,
      sources: project.sources,
    }));
  }

  async createProject(org: string, body: ProjectDto) {
    return this._projectsRepository.createProject(org, await this.validate(org, body));
  }

  async updateProject(org: string, id: string, body: ProjectDto) {
    await this.findProject(org, id);
    await this._projectsRepository.updateProject(org, id, await this.validate(org, body));
    return { id };
  }

  async deleteProject(org: string, id: string) {
    await this.findProject(org, id);
    await this._projectsRepository.deleteProject(org, id);
    return { id };
  }

  private async findProject(org: string, id: string) {
    if (!(await this._projectsRepository.getProject(org, id))) {
      throw new BadRequestException('Project not found');
    }
  }

  private async validate(org: string, body: ProjectDto) {
    const name = body.name.trim();
    if (!name) {
      throw new BadRequestException('Project name is required');
    }

    const integrations = [...new Set(body.integrations)];
    if (
      integrations.length &&
      (await this._projectsRepository.countIntegrations(org, integrations)) !==
        integrations.length
    ) {
      throw new BadRequestException('Channel not found');
    }

    const folders = [...new Set(body.folders)];
    if (
      folders.length &&
      (await this._projectsRepository.countFolders(org, folders)) !== folders.length
    ) {
      throw new BadRequestException('Folder not found');
    }

    const drive = [...new Set(body.driveFolders.map(driveFolderId))];
    return {
      name,
      description: (body.description || '').trim(),
      integrations,
      folders,
      sources: drive.map((externalId) => ({
        type: 'google_drive',
        externalId,
        url: `https://drive.google.com/drive/folders/${externalId}`,
      })),
    };
  }
}
