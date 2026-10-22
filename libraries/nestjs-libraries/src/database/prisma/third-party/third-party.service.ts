import { Injectable } from '@nestjs/common';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { ThirdPartyRepository } from '@gitroom/nestjs-libraries/database/prisma/third-party/third-party.repository';

@Injectable()
export class ThirdPartyService {
  constructor(private _thirdPartyRepository: ThirdPartyRepository) {}

  getAllThirdPartiesByOrganization(org: string) {
    return this._thirdPartyRepository.getAllThirdPartiesByOrganization(org);
  }

  deleteIntegration(org: string, id: string) {
    return this._thirdPartyRepository.deleteIntegration(org, id);
  }

  getIntegrationById(org: string, id: string) {
    return this._thirdPartyRepository.getIntegrationById(org, id);
  }

  // decrypted key of a connected integration, for services that call it themselves
  async getApiKey(org: string, identifier: string) {
    const found = await this._thirdPartyRepository.getApiKeyByIdentifier(org, identifier);
    return found ? AuthService.fixedDecryption(found.apiKey) : undefined;
  }

  saveIntegration(
    org: string,
    identifier: string,
    apiKey: string,
    data: { name: string; username: string; id: string }
  ) {
    return this._thirdPartyRepository.saveIntegration(org, identifier, apiKey, data);
  }
}
