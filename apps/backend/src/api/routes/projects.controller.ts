import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import {
  ProjectDto,
  ProjectFileImportDto,
  ProjectFilesQueryDto,
} from '@gitroom/nestjs-libraries/dtos/projects/project.dto';
import { ClientsService } from '@gitroom/nestjs-libraries/database/prisma/clients/clients.service';
import { ClientDto } from '@gitroom/nestjs-libraries/dtos/clients/client.dto';

@ApiTags('Projects')
@Controller('/projects')
export class ProjectsController {
  constructor(
    private _projectsService: ProjectsService,
    private _clientsService: ClientsService
  ) {}

  @Get('/')
  getProjects(@GetOrgFromRequest() org: Organization) {
    return this._projectsService.getProjects(org.id);
  }

  // the customers who sign in to the portal (/musteri) to follow their projects
  @Get('/clients')
  getClients(@GetOrgFromRequest() org: Organization) {
    return this._clientsService.getClients(org.id);
  }

  @Post('/clients')
  createClient(@GetOrgFromRequest() org: Organization, @Body() body: ClientDto) {
    return this._clientsService.createClient(org.id, body);
  }

  @Put('/clients/:clientId')
  updateClient(
    @GetOrgFromRequest() org: Organization,
    @Param('clientId') clientId: string,
    @Body() body: ClientDto
  ) {
    return this._clientsService.updateClient(org.id, clientId, body);
  }

  @Delete('/clients/:clientId')
  deleteClient(
    @GetOrgFromRequest() org: Organization,
    @Param('clientId') clientId: string
  ) {
    return this._clientsService.deleteClient(org.id, clientId);
  }

  // the service account the Drive folders are shared with
  @Get('/drive')
  driveInfo() {
    return this._projectsService.driveInfo();
  }

  // the preview of a Drive file, for the tiles of the media library
  @Get('/files/:fileId/thumbnail')
  async fileThumbnail(
    @GetOrgFromRequest() org: Organization,
    @Param('fileId') fileId: string,
    @Res() res: Response
  ) {
    const picture = await this._projectsService.getFileThumbnail(org.id, fileId);
    if (!picture) {
      res.status(404).send();
      return;
    }

    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=21600' });
    res.send(picture);
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
