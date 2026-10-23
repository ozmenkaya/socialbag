import { HttpException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import dayjs from 'dayjs';
import { McpAccessRepository } from '@gitroom/nestjs-libraries/database/prisma/mcp-access/mcp.access.repository';
import { McpAccessKeyDto } from '@gitroom/nestjs-libraries/dtos/mcp/mcp.access.key.dto';

export const MCP_ACCESS_KEY_PREFIX = 'pmk_';

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

@Injectable()
export class McpAccessService {
  constructor(private _mcpAccessRepository: McpAccessRepository) {}

  getKeys(orgId: string) {
    return this._mcpAccessRepository.getKeys(orgId);
  }

  async createKey(orgId: string, body: McpAccessKeyDto) {
    const integrationIds = [...new Set(body.integrationIds)];
    // an id that is not a channel of this organization must never turn into
    // an empty list, that would be a key for every channel
    if (
      integrationIds.length &&
      (await this._mcpAccessRepository.countIntegrations(
        orgId,
        integrationIds
      )) !== integrationIds.length
    ) {
      throw new HttpException('Unknown channel selected', 400);
    }

    const key = `${MCP_ACCESS_KEY_PREFIX}${randomBytes(32).toString('hex')}`;
    const { id } = await this._mcpAccessRepository.createKey(
      orgId,
      { ...body, integrationIds },
      hashKey(key),
      `${key.slice(0, 8)}...${key.slice(-4)}`
    );

    // the key is only shown once, only its hash is stored
    return { id, key };
  }

  deleteKey(orgId: string, id: string) {
    return this._mcpAccessRepository.deleteKey(orgId, id);
  }

  async resolveKey(key: string) {
    const access = await this._mcpAccessRepository.getKeyByHash(hashKey(key));
    if (!access) {
      return null;
    }

    if (
      !access.lastUsedAt ||
      dayjs().diff(dayjs(access.lastUsedAt), 'minute') >= 5
    ) {
      this._mcpAccessRepository.touchKey(access.id).catch(() => undefined);
    }

    return {
      organization: access.organization,
      scope: {
        readOnly: access.readOnly,
        integrationIds: access.integrationIds,
      },
    };
  }
}
