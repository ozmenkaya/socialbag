import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PostApproval } from '@prisma/client';
import { ApprovalsRepository } from '@gitroom/nestjs-libraries/database/prisma/approvals/approvals.repository';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { ProjectsRepository } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.repository';
import { whatsappNumber } from '@gitroom/nestjs-libraries/database/prisma/projects/projects.service';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';

const parseImages = (image?: string | null): { path: string }[] => {
  try {
    return (JSON.parse(image || '[]') || []).filter((p: any) => p?.path);
  } catch (err) {
    return [];
  }
};

@Injectable()
export class ApprovalsService {
  constructor(
    private _approvalsRepository: ApprovalsRepository,
    private _postsService: PostsService,
    private _projectsRepository: ProjectsRepository,
    private _notificationService: NotificationService
  ) {}

  // Holds the posts as drafts and makes the link the customer approves them
  // from, with a WhatsApp link that opens the chat with the message written
  async requestApproval(
    org: string,
    body: { postIds: string[]; projectId?: string; phone?: string; message?: string }
  ) {
    const postIds = [...new Set(body.postIds)];
    if (!postIds.length) {
      throw new BadRequestException('Pass at least one post');
    }

    if (body.projectId && !(await this._projectsRepository.getBrand(org, body.projectId))) {
      throw new BadRequestException('Project not found');
    }

    const posts = [];
    for (const id of postIds) {
      const [post] = await this._postsService.getPostsRecursively(id, true, org, true);
      if (!post) {
        throw new BadRequestException(`Post ${id} not found`);
      }
      if (post.parentPostId) {
        throw new BadRequestException(
          `${id} belongs to a comment, pass the id of the main post`
        );
      }
      if (post.state !== 'DRAFT' && post.state !== 'QUEUE') {
        throw new BadRequestException(
          `${id} was already published (or failed), only posts waiting to go out can be sent for approval`
        );
      }
      posts.push(post);
    }

    // without a project, the one every channel of the posts posts for, so
    // the design also waits on the customer portal of that project
    const projectId =
      body.projectId ||
      (await (async () => {
        const channels = [...new Set(posts.map((p) => p.integrationId!).filter((p) => p))];
        const links = await this._projectsRepository.getProjectsOfIntegrations(org, channels);
        const shared = [...new Set(links.map((p) => p.projectId))].filter((projectId) =>
          channels.every((channel) =>
            links.some((p) => p.projectId === projectId && p.integrationId === channel)
          )
        );
        return shared.length === 1 ? shared[0] : undefined;
      })());
    const project = projectId
      ? await this._projectsRepository.getBrand(org, projectId)
      : null;

    // nothing goes out before the customer answers
    for (const post of posts) {
      if (post.state === 'QUEUE') {
        await this._postsService.changePostStatus(org, post.id, 'draft');
      }
    }

    // a newer link for the same posts replaces the ones still waiting, one
    // that also holds other posts stays so these still get an answer
    const pending = await this._approvalsRepository.getPendingOfPosts(org, postIds);
    await this._approvalsRepository.replace(
      pending
        .filter((p) => p.postIds.every((id) => postIds.includes(id)))
        .map((p) => p.id)
    );

    const phone =
      whatsappNumber(body.phone) ||
      whatsappNumber((project?.brand as any)?.approvalPhone) ||
      undefined;

    const approval = await this._approvalsRepository.createApproval({
      organizationId: org,
      projectId: project?.id,
      token: randomBytes(18).toString('base64url'),
      postIds,
      phone,
    });

    const link = `${process.env.FRONTEND_URL}/p/onay/${approval.token}`;
    const message = `${
      body.message?.trim() ||
      `Merhaba, ${
        project ? `${project.name} için ` : ''
      }hazırladığımız yeni paylaşımın tasarımı onayınızı bekliyor. Aşağıdaki linkten inceleyip onaylayabilir ya da düzeltme isteyebilirsiniz:`
    }\n\n${link}`;

    return {
      approvalId: approval.id,
      link,
      phone: phone || null,
      // without a number WhatsApp asks whom to send it to
      whatsappUrl: `https://wa.me/${phone || ''}?text=${encodeURIComponent(message)}`,
      message,
    };
  }

  // a post edited (or scheduled) after the link was sent is not the design the
  // customer looks at, a new link has to be sent for it
  private async isOutdated(approval: { organizationId: string; createdAt: Date; postIds: string[] }) {
    for (const id of approval.postIds) {
      const [post] = await this._postsService.getPostsRecursively(
        id,
        false,
        approval.organizationId,
        true
      );
      if (post && post.updatedAt > approval.createdAt) {
        return true;
      }
    }
    return false;
  }

  // what the customer sees on the approval page
  async getPublic(token: string) {
    const approval = await this._approvalsRepository.getByToken(token);
    if (!approval || approval.status === 'replaced') {
      throw new NotFoundException('Approval not found');
    }

    // the link knows nothing of the portal
    const { id, projectId, ...design } = await this.present(approval);
    return design;
  }

  private async present(approval: PostApproval) {
    const project = approval.projectId
      ? await this._projectsRepository.getBrand(approval.organizationId, approval.projectId)
      : null;

    const posts = [];
    for (const id of approval.postIds) {
      const thread = await this._postsService.getPostsRecursively(
        id,
        true,
        approval.organizationId,
        true
      );
      if (!thread.length) {
        continue;
      }
      const [root] = thread;
      const integration = (root as any).integration;
      posts.push({
        id: root.id,
        publishDate: root.publishDate,
        channel: {
          name: integration?.name,
          picture: integration?.picture,
          platform: integration?.providerIdentifier,
        },
        values: thread.map((p) => ({
          content: p.content,
          images: parseImages(p.image).map((i) => i.path),
        })),
      });
    }

    return {
      id: approval.id,
      projectId: approval.projectId,
      createdAt: approval.createdAt,
      status:
        approval.status === 'pending' && (await this.isOutdated(approval))
          ? 'outdated'
          : approval.status,
      note: approval.note,
      respondedAt: approval.respondedAt,
      project: project
        ? {
            name: project.name,
            logo: (project.brand as any)?.logoPath || null,
            primary: (project.brand as any)?.primary || null,
          }
        : null,
      posts,
    };
  }

  async respond(token: string, action: 'approve' | 'revision', note?: string) {
    const approval = await this._approvalsRepository.getByToken(token);
    if (!approval || approval.status === 'replaced') {
      throw new NotFoundException('Approval not found');
    }

    return this.answer(approval, action, note);
  }

  // the designs of the projects a signed in customer follows
  async getProjectsApprovals(org: string, projectIds: string[]) {
    if (!projectIds.length) {
      return [];
    }
    const list = [
      ...(await this._approvalsRepository.getApprovalsOfProjects(org, projectIds, ['pending'])),
      ...(await this._approvalsRepository.getApprovalsOfProjects(
        org,
        projectIds,
        ['approved', 'revision'],
        20
      )),
    ];
    const approvals = [];
    for (const approval of list) {
      approvals.push(await this.present(approval));
    }
    return approvals;
  }

  async respondForProjects(
    org: string,
    projectIds: string[],
    id: string,
    action: 'approve' | 'revision',
    note?: string
  ) {
    const approval = await this._approvalsRepository.getById(id);
    if (
      !approval ||
      approval.organizationId !== org ||
      !approval.projectId ||
      !projectIds.includes(approval.projectId) ||
      approval.status === 'replaced'
    ) {
      throw new NotFoundException('Approval not found');
    }

    return this.answer(approval, action, note);
  }

  private async answer(
    approval: PostApproval,
    action: 'approve' | 'revision',
    note?: string
  ) {
    if (action === 'revision' && !note?.trim()) {
      throw new BadRequestException('Write what should change');
    }

    if (approval.status === 'pending' && (await this.isOutdated(approval))) {
      throw new BadRequestException(
        'Bu tasarım link gönderildikten sonra değişti, yeni linki bekleyin'
      );
    }

    const answered = await this._approvalsRepository.answer(
      approval.id,
      action === 'approve' ? 'approved' : 'revision',
      note?.trim()
    );
    if (!answered.count) {
      throw new BadRequestException('This design was already answered');
    }

    const org = approval.organizationId;
    const project = approval.projectId
      ? await this._projectsRepository.getBrand(org, approval.projectId)
      : null;
    const name = project ? `${project.name}: ` : '';

    if (action === 'revision') {
      await this._notificationService.inAppNotification(
        org,
        'Müşteri düzeltme istedi',
        `${name}Müşteri tasarımda düzeltme istedi: "${note!.trim()}"`,
        true
      );
      return { status: 'revision' };
    }

    // a post deleted or published from the calendar meanwhile is left alone
    let scheduled = 0;
    for (const id of approval.postIds) {
      const [post] = await this._postsService.getPostsRecursively(id, true, org, true);
      if (post?.state === 'DRAFT') {
        await this._postsService.changePostStatus(org, id, 'schedule');
        scheduled++;
      }
    }

    await this._notificationService.inAppNotification(
      org,
      'Müşteri tasarımı onayladı',
      `${name}Müşteri tasarımı onayladı, ${scheduled} gönderi planlandı.`,
      true
    );

    return { status: 'approved' };
  }

  async getApprovals(org: string, status?: string, postId?: string) {
    const list = await this._approvalsRepository.getApprovals(org, status, postId);
    return list.map((p) => ({
      approvalId: p.id,
      status: p.status,
      note: p.note,
      postIds: p.postIds,
      projectId: p.projectId,
      phone: p.phone,
      link: `${process.env.FRONTEND_URL}/p/onay/${p.token}`,
      createdAt: p.createdAt,
      respondedAt: p.respondedAt,
    }));
  }
}
