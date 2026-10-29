import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { ClientsService } from '@gitroom/nestjs-libraries/database/prisma/clients/clients.service';
import {
  PortalAnswerDto,
  PortalPasswordDto,
  PortalPostsQueryDto,
} from '@gitroom/nestjs-libraries/dtos/clients/client.dto';
import { PORTAL_COOKIE } from '@gitroom/backend/services/auth/portal.auth.middleware';

// without expires the session ends when the browser is closed
export const setPortalCookie = (response: Response, token: string, expires?: Date) => {
  response.cookie(PORTAL_COOKIE, token, {
    domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    ...(!process.env.NOT_SECURED
      ? {
          secure: true,
          httpOnly: true,
          sameSite: 'none',
        }
      : {}),
    ...(expires ? { expires } : {}),
  });
};

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
