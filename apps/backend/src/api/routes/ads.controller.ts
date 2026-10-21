import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { AdsService } from '@gitroom/nestjs-libraries/database/prisma/ads/ads.service';
import {
  BoostStatusDto,
  ConnectAdsDto,
  CreateBoostDto,
} from '@gitroom/nestjs-libraries/dtos/ads/ads.dto';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';

type OrgWithRole = Organization & { users?: { role: string }[] };

// Ads spend money, team members with the USER role can only look
const onlyAdmins = (org: OrgWithRole) => {
  if (org?.users?.[0]?.role === 'USER') {
    throw new HttpForbiddenException();
  }
};

@ApiTags('Ads')
@Controller('/ads')
export class AdsController {
  constructor(private _adsService: AdsService) {}

  @Get('/providers')
  getProviders() {
    return this._adsService.getProviders();
  }

  @Get('/connections')
  getConnections(@GetOrgFromRequest() org: Organization) {
    return this._adsService.getConnections(org.id);
  }

  @Delete('/connections/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  deleteConnection(
    @GetOrgFromRequest() org: OrgWithRole,
    @Param('id') id: string
  ) {
    onlyAdmins(org);
    return this._adsService.deleteConnection(org.id, id);
  }

  @Get('/connections/:id/accounts')
  getAdAccounts(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._adsService.getAdAccounts(org.id, id);
  }

  @Get('/boosts/:postId')
  getBoosts(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string
  ) {
    return this._adsService.getBoosts(org.id, postId);
  }

  @Post('/boosts')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  createBoost(
    @GetOrgFromRequest() org: OrgWithRole,
    @Body() body: CreateBoostDto
  ) {
    onlyAdmins(org);
    return this._adsService.createBoost(org.id, body);
  }

  @Put('/boosts/:id/status')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  changeBoostStatus(
    @GetOrgFromRequest() org: OrgWithRole,
    @Param('id') id: string,
    @Body() body: BoostStatusDto
  ) {
    onlyAdmins(org);
    return this._adsService.changeBoostStatus(org.id, id, body);
  }

  @Delete('/boosts/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  deleteBoost(
    @GetOrgFromRequest() org: OrgWithRole,
    @Param('id') id: string
  ) {
    onlyAdmins(org);
    return this._adsService.deleteBoost(org.id, id);
  }

  @Get('/:provider/url')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  getAuthUrl(
    @GetOrgFromRequest() org: OrgWithRole,
    @Param('provider') provider: string
  ) {
    onlyAdmins(org);
    return this._adsService.getAuthUrl(org.id, provider);
  }

  @Post('/:provider/connect')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  connect(
    @GetOrgFromRequest() org: OrgWithRole,
    @Param('provider') provider: string,
    @Body() body: ConnectAdsDto
  ) {
    onlyAdmins(org);
    return this._adsService.connect(org.id, provider, body.code, body.state);
  }
}
