import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { McpAccessKeyDto } from '@gitroom/nestjs-libraries/dtos/mcp/mcp.access.key.dto';

@Injectable()
export class McpAccessRepository {
  constructor(
    private _keys: PrismaRepository<'mcpAccessKey'>,
    private _integration: PrismaRepository<'integration'>
  ) {}

  getKeys(orgId: string) {
    return this._keys.model.mcpAccessKey.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPreview: true,
        readOnly: true,
        integrationIds: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  async countIntegrations(orgId: string, ids: string[]) {
    return this._integration.model.integration.count({
      where: { id: { in: ids }, organizationId: orgId, deletedAt: null },
    });
  }

  createKey(
    orgId: string,
    body: McpAccessKeyDto,
    keyHash: string,
    keyPreview: string
  ) {
    return this._keys.model.mcpAccessKey.create({
      data: {
        organizationId: orgId,
        name: body.name,
        readOnly: body.readOnly,
        integrationIds: body.integrationIds,
        keyHash,
        keyPreview,
      },
      select: { id: true },
    });
  }

  deleteKey(orgId: string, id: string) {
    return this._keys.model.mcpAccessKey.update({
      where: { id, organizationId: orgId },
      data: { deletedAt: new Date() },
      select: { id: true },
    });
  }

  getKeyByHash(keyHash: string) {
    return this._keys.model.mcpAccessKey.findFirst({
      where: { keyHash, deletedAt: null, organization: { deletedAt: null } },
      select: {
        id: true,
        readOnly: true,
        integrationIds: true,
        lastUsedAt: true,
        organization: {
          include: {
            subscription: {
              select: {
                subscriptionTier: true,
                totalChannels: true,
                isLifetime: true,
              },
            },
          },
        },
      },
    });
  }

  touchKey(id: string) {
    return this._keys.model.mcpAccessKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
      select: { id: true },
    });
  }
}
