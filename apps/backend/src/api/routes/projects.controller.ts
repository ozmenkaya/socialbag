import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import {
  ProjectDto,
  ProjectFileImportDto,
  ProjectFilesQueryDto,
} from '@gitroom/nestjs-libraries/dtos/projects/project.dto';

@ApiTags('Projects')
@Controller('/projects')
export class ProjectsController {
  constructor(private _projectsService: ProjectsService) {}

  @Get('/')
  getProjects(@GetOrgFromRequest() org: Organization) {
    return this._projectsService.getProjects(org.id);
  }

  // the service account the Drive folders are shared with
  @Get('/drive')
  driveInfo() {
    return this._projectsService.driveInfo();
  }

  @Post('/files/:fileId/import')
  importFile(
    @GetOrgFromRequest() org: Organization,
    @Param('fileId') fileId: string,
    @Body() body: ProjectFileImportDto
  ) {
    return this._projectsService.importFile(org.id, fileId, body.folderId);
  }

  @Post('/')
  createProject(
    @GetOrgFromRequest() org: Organization,
    @Body() body: ProjectDto
  ) {
    return this._projectsService.createProject(org.id, body);
  }

  @Put('/:id')
  updateProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: ProjectDto
  ) {
    return this._projectsService.updateProject(org.id, id, body);
  }

  @Post('/:id/sync')
  syncProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._projectsService.syncProject(org.id, id);
  }

  @Get('/:id/files')
  getFiles(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Query() query: ProjectFilesQueryDto
  ) {
    return this._projectsService.getFiles(org.id, id, query);
  }

  @Delete('/:id')
  deleteProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._projectsService.deleteProject(org.id, id);
  }
}
