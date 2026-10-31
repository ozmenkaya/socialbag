import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { ProjectsService } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';

@Injectable()
@Activity()
export class ProjectsActivity {
  constructor(private _projectsService: ProjectsService) {}

  @ActivityMethod()
  async syncAllProjects() {
    return this._projectsService.syncAllProjects();
  }
}
