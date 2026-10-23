import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { McpAccessService } from '@gitroom/nestjs-libraries/database/prisma/mcp-access/mcp.access.service';
import { McpAccessKeyDto } from '@gitroom/nestjs-libraries/dtos/mcp/mcp.access.key.dto';

@ApiTags('MCP Access')
@Controller('/mcp-keys')
export class McpAccessController {
  constructor(private _mcpAccessService: McpAccessService) {}

  @Get('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  getKeys(@GetOrgFromRequest() org: Organization) {
    return this._mcpAccessService.getKeys(org.id);
  }

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  createKey(
    @GetOrgFromRequest() org: Organization,
    @Body() body: McpAccessKeyDto
  ) {
    return this._mcpAccessService.createKey(org.id, body);
  }

  @Delete('/:id')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  deleteKey(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._mcpAccessService.deleteKey(org.id, id);
  }
}
