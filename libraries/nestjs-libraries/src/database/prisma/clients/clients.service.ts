import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { sign, verify } from 'jsonwebtoken';
import dayjs from 'dayjs';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { ClientsRepository } from '@gitroom/nestjs-libraries/database/prisma/clients/clients.repository';
import { ApprovalsService } from '@gitroom/nestjs-libraries/database/prisma/approvals/approvals.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { ProjectsRepository } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.repository';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

// signed apart from the sessions of the app, a session of the portal is never
// read as the one of a user of the agency
const portalSecret = () => `${process.env.JWT_SECRET}:customer-portal`;
// compared against when the username does not exist, so both answer as slowly
const MISSING_HASH = AuthService.hashPassword(randomBytes(16).toString('hex'));
export const PORTAL_REMEMBER_DAYS = 30;
// wrong passwords an account takes in 15 minutes, from wherever they come
const MAX_ATTEMPTS = 10;

export type PortalClient = NonNullable<
  Awaited<ReturnType<ClientsRepository['getPortalClient']>>
>;

const parseImages = (image?: string | null): string[] => {
  try {
    return (JSON.parse(image || '[]') || [])
      .filter((p: any) => p?.path)
      .map((p: any) => p.path);
  } catch (err) {
    return [];
  }
};

@Injectable()
export class ClientsService {
  constructor(
    private _clientsRepository: ClientsRepository,
    private _approvalsService: ApprovalsService,
    private _postsService: PostsService,
    private _projectsRepository: ProjectsRepository
  ) {}

  getClients(org: string) {
    return this._clientsRepository.getClients(org).then((list) =>
      list.map((p) => ({
        id: p.id,
        name: p.name,
        username: p.username,
        lastLoginAt: p.lastLoginAt,
        createdAt: p.createdAt,
        projects: p.projects.map((r) => r.project),
      }))
    );
  }

  private async validate(
    org: string,
    body: { name: string; username: string; password?: string; projectIds: string[] },
    exceptId?: string
  ) {
    const username = body.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      throw new BadRequestException(
        'The username takes 3 to 40 letters (a-z), digits, dots, dashes or underscores'
      );
    }
    if (await this._clientsRepository.usernameTaken(username, exceptId)) {
      throw new BadRequestException('This username is already taken');
    }
    if (body.password && body.password.length < 6) {
      throw new BadRequestException('The password needs at least 6 characters');
    }

    const projectIds = [...new Set(body.projectIds)];
    if ((await this._projectsRepository.countProjects(org, projectIds)) !== projectIds.length) {
      throw new BadRequestException('Project not found');
    }

    return { name: body.name.trim(), username, projectIds };
  }

  // the password is shown once to the agency, to send it to the customer
  async createClient(
    org: string,
    body: { name: string; username: string; password?: string; projectIds: string[] }
  ) {
    const data = await this.validate(org, body);
    const password = body.password || this.generatePassword();
    const client = await this._clientsRepository.createClient(org, {
      ...data,
      password: AuthService.hashPassword(password),
    });

    return { id: client.id, username: data.username, password };
  }

  async updateClient(
    org: string,
    id: string,
    body: { name: string; username: string; password?: string; projectIds: string[] }
  ) {
    if (!(await this._clientsRepository.getClient(org, id))) {
      throw new NotFoundException('Customer not found');
    }
    const data = await this.validate(org, body, id);
    await this._clientsRepository.updateClient(id, {
      ...data,
      ...(body.password ? { password: AuthService.hashPassword(body.password) } : {}),
    });

    return { id, username: data.username, password: body.password || undefined };
  }

  async deleteClient(org: string, id: string) {
    if (!(await this._clientsRepository.getClient(org, id))) {
      throw new NotFoundException('Customer not found');
    }
    await this._clientsRepository.deleteClient(id);
    return { id };
  }

  // easy to read out and to type on a phone
  generatePassword() {
    const letters = 'abcdefghjkmnpqrstuvwxyz';
    const bytes = randomBytes(8);
    let password = '';
    for (let i = 0; i < 6; i++) {
      password += letters[bytes[i] % letters.length];
    }
    return `${password}${1000 + (bytes.readUInt16BE(6) % 9000)}`;
  }

  // the session of the portal: 30 days with "remember me", otherwise until
  // the browser is closed (the token itself still ends after a day)
  async login(username: string, password: string, remember: boolean) {
    const name = username.trim().toLowerCase();
    const attempts = `portal-login:${name}`;
    await this.checkAttempts(attempts);
    const client = await this._clientsRepository.getLogin(name);
    const valid = AuthService.comparePassword(password, client?.password || MISSING_HASH);
    if (!client || !valid) {
      await this.failedAttempt(attempts);
      throw new BadRequestException('Kullanıcı adı ya da şifre hatalı');
    }

    await ioRedis.del(attempts);
    await this._clientsRepository.setLastLogin(client.id);
    return {
      token: this.sign(client.id, client.sessionVersion, remember),
      expires: remember ? dayjs().add(PORTAL_REMEMBER_DAYS, 'day').toDate() : undefined,
    };
  }

  private async checkAttempts(key: string) {
    if (Number((await ioRedis.get(key)) || 0) >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Çok fazla hatalı deneme yapıldı, 15 dakika sonra tekrar deneyin',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private async failedAttempt(key: string) {
    const count = Number((await ioRedis.get(key)) || 0) + 1;
    await ioRedis.set(key, String(count), 'EX', 900);
  }

  private sign(id: string, version: number, remember: boolean) {
    return sign({ portalClient: id, v: version, r: remember }, portalSecret(), {
      expiresIn: remember ? `${PORTAL_REMEMBER_DAYS}d` : '1d',
    });
  }

  // the customer of a session, undefined once it ended or the password changed
  async verify(
    token?: string
  ): Promise<{ client: PortalClient; remember: boolean } | undefined> {
    if (!token) {
      return undefined;
    }
    try {
      const payload = verify(token, portalSecret()) as {
        portalClient?: string;
        v?: number;
        r?: boolean;
      };
      if (!payload?.portalClient) {
        return undefined;
      }
      const client = await this._clientsRepository.getPortalClient(payload.portalClient);
      return client && client.sessionVersion === payload.v
        ? { client, remember: !!payload.r }
        : undefined;
    } catch (err) {
      return undefined;
    }
  }

  projectIds(client: PortalClient) {
    return client.projects.map((p) => p.project.id);
  }

  me(client: PortalClient) {
    return {
      name: client.name,
      username: client.username,
      agency: client.organization.name,
      projects: client.projects.map(({ project }) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        logo: (project.brand as any)?.logoPath || null,
        primary: (project.brand as any)?.primary || null,
        channels: project.integrations.map(({ integration }) => ({
          id: integration.id,
          name: integration.name,
          picture: integration.picture,
          platform: integration.providerIdentifier,
        })),
      })),
    };
  }

  async getPosts(
    client: PortalClient,
    query: { projectId?: string; startDate: string; endDate: string }
  ) {
    const projects = client.projects
      .map((p) => p.project)
      .filter((p) => !query.projectId || p.id === query.projectId);
    // a channel shared by two projects of the customer is shown once
    const channels = new Map<string, string[]>();
    for (const project of projects) {
      for (const { integration } of project.integrations) {
        channels.set(integration.id, [...(channels.get(integration.id) || []), project.id]);
      }
    }
    if (!channels.size) {
      return [];
    }

    const start = dayjs(query.startDate);
    const end = dayjs(query.endDate);
    if (!start.isValid() || !end.isValid() || end.diff(start, 'day') > 62) {
      throw new BadRequestException('Pick a period of two months at most');
    }

    const posts = await this._postsService.getChannelPosts(
      client.organizationId,
      [...channels.keys()],
      start.toDate(),
      end.toDate()
    );

    return posts.map((p) => ({
      id: p.id,
      publishDate: p.publishDate,
      state: p.state === 'PUBLISHED' ? 'published' : 'scheduled',
      url: p.state === 'PUBLISHED' ? p.releaseURL : null,
      content: p.content,
      images: parseImages(p.image),
      projectIds: channels.get(p.integration.id) || [],
      channel: {
        name: p.integration.name,
        picture: p.integration.picture,
        platform: p.integration.providerIdentifier,
      },
    }));
  }

  getApprovals(client: PortalClient) {
    return this._approvalsService.getProjectsApprovals(
      client.organizationId,
      this.projectIds(client)
    );
  }

  answerApproval(
    client: PortalClient,
    id: string,
    action: 'approve' | 'revision',
    note?: string
  ) {
    return this._approvalsService.respondForProjects(
      client.organizationId,
      this.projectIds(client),
      id,
      action,
      note
    );
  }

  // the session the password was changed from stays open (a new token for
  // it), the others end
  async changePassword(
    client: PortalClient,
    remember: boolean,
    current: string,
    password: string
  ) {
    const attempts = `portal-password:${client.id}`;
    await this.checkAttempts(attempts);
    const stored = await this._clientsRepository.getPassword(client.id);
    if (!stored || !AuthService.comparePassword(current, stored.password)) {
      await this.failedAttempt(attempts);
      throw new BadRequestException('Mevcut şifre hatalı');
    }
    await ioRedis.del(attempts);
    if (password.length < 6) {
      throw new BadRequestException('Yeni şifre en az 6 karakter olmalı');
    }
    const updated = await this._clientsRepository.setPassword(
      client.id,
      AuthService.hashPassword(password)
    );
    return {
      token: this.sign(client.id, updated.sessionVersion, remember),
      expires: remember ? dayjs().add(PORTAL_REMEMBER_DAYS, 'day').toDate() : undefined,
    };
  }
}
