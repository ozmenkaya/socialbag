import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import {
  CreateMediaFolderDto,
  MediaFolderIntegrationsDto,
  MoveMediaDto,
  UpdateMediaFolderDto,
} from '@gitroom/nestjs-libraries/dtos/media/media.folder.dto';

@ApiTags('Media')
@Controller('/media-folders')
export class MediaFoldersController {
  constructor(private _mediaService: MediaService) {}

  @Get('/')
  getFolders(@GetOrgFromRequest() org: Organization) {
    return this._mediaService.getFolders(org.id);
  }

  @Post('/')
  createFolder(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateMediaFolderDto
  ) {
    return this._mediaService.createFolder(org.id, body);
  }

  @Put('/move')
  moveMedia(
    @GetOrgFromRequest() org: Organization,
    @Body() body: MoveMediaDto
  ) {
    return this._mediaService.moveMedia(org.id, body);
  }

  @Put('/:id')
  updateFolder(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdateMediaFolderDto
  ) {
    return this._mediaService.updateFolder(org.id, id, body);
  }

  @Put('/:id/integrations')
  setFolderIntegrations(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: MediaFolderIntegrationsDto
  ) {
    return this._mediaService.setFolderIntegrations(org.id, id, body);
  }

  @Delete('/:id')
  deleteFolder(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._mediaService.deleteFolder(org.id, id);
  }
}
