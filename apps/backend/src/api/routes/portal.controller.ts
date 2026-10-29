import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { streamUploadOptions } from '@gitroom/nestjs-libraries/upload/multer.stream.engine';
import { ThrottlerPortalClientGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ClientsService } from '@gitroom/nestjs-libraries/database/prisma/clients/clients.service';
import {
  PortalAnswerDto,
  PortalPasswordDto,
  PortalPostsQueryDto,
  PortalRequestDto,
} from '@gitroom/nestjs-libraries/dtos/clients/client.dto';
import { setPortalCookie } from '@gitroom/backend/services/auth/portal.auth.middleware';

// What a signed in customer sees of the projects given to them (signing in
// and out is in the public controller)
@ApiTags('Customer portal')
@Controller('/portal')
export class PortalController {
  constructor(private _clientsService: ClientsService) {}

  @Get('/me')
  me(@Req() req: Request) {
    // @ts-ignore
    return this._clientsService.me(req.portalClient);
  }

  @Get('/posts')
  posts(@Req() req: Request, @Query() query: PortalPostsQueryDto) {
    // @ts-ignore
    return this._clientsService.getPosts(req.portalClient, query);
  }

  @Get('/approvals')
  approvals(@Req() req: Request) {
    // @ts-ignore
    return this._clientsService.getApprovals(req.portalClient);
  }

  @Post('/approvals/:id')
  answer(@Req() req: Request, @Param('id') id: string, @Body() body: PortalAnswerDto) {
    return this._clientsService.answerApproval(
      // @ts-ignore
      req.portalClient,
      id,
      body.action,
      body.note
    );
  }

  // a photo or video for a request, the session is checked (and the guard
  // counts the customer's uploads) before anything is streamed to storage
  @UseGuards(ThrottlerPortalClientGuard)
  @Throttle({ default: { limit: 60, ttl: 3600000 } })
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file', streamUploadOptions()))
  upload(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    // @ts-ignore
    return this._clientsService.uploadFile(req.portalClient, file);
  }

  // a file the customer took back before sending the request
  @Delete('/upload/:mediaId')
  removeUpload(@Req() req: Request, @Param('mediaId') mediaId: string) {
    // @ts-ignore
    return this._clientsService.removeUpload(req.portalClient, mediaId);
  }

  @Get('/requests')
  requests(@Req() req: Request) {
    // @ts-ignore
    return this._clientsService.getRequests(req.portalClient);
  }

  @UseGuards(ThrottlerPortalClientGuard)
  @Throttle({ default: { limit: 30, ttl: 3600000 } })
  @Post('/requests')
  createRequest(@Req() req: Request, @Body() body: PortalRequestDto) {
    // @ts-ignore
    return this._clientsService.createRequest(req.portalClient, body);
  }

  @Post('/password')
  async password(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() body: PortalPasswordDto
  ) {
    const { token, expires } = await this._clientsService.changePassword(
      // @ts-ignore
      req.portalClient,
      // @ts-ignore
      req.portalRemember,
      body.current,
      body.password
    );
    setPortalCookie(response, token, expires);
    return { changed: true };
  }
}
