import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import { ProjectDto } from '@gitroom/nestjs-libraries/dtos/projects/project.dto';

@ApiTags('Projects')
@Controller('/projects')
export class ProjectsController {
  constructor(private _projectsService: ProjectsService) {}

  @Get('/')
  getProjects(@GetOrgFromRequest() org: Organization) {
    return this._projectsService.getProjects(org.id);
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

  @Delete('/:id')
  deleteProject(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._projectsService.deleteProject(org.id, id);
  }
}
