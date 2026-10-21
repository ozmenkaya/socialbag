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
  deleteConnection(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
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
  createBoost(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreateBoostDto
  ) {
    return this._adsService.createBoost(org.id, body);
  }

  @Put('/boosts/:id/status')
  changeBoostStatus(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: BoostStatusDto
  ) {
    return this._adsService.changeBoostStatus(org.id, id, body);
  }

  @Delete('/boosts/:id')
  deleteBoost(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._adsService.deleteBoost(org.id, id);
  }

  @Get('/:provider/url')
  getAuthUrl(
    @GetOrgFromRequest() org: Organization,
    @Param('provider') provider: string
  ) {
    return this._adsService.getAuthUrl(org.id, provider);
  }

  @Post('/:provider/connect')
  connect(
    @GetOrgFromRequest() org: Organization,
    @Param('provider') provider: string,
    @Body() body: ConnectAdsDto
  ) {
    return this._adsService.connect(org.id, provider, body.code, body.state);
  }
}
