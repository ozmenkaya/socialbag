import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ApprovalsRepository {
  constructor(private _approval: PrismaRepository<'postApproval'>) {}

  createApproval(data: {
    organizationId: string;
    projectId?: string;
    token: string;
    postIds: string[];
    phone?: string;
  }) {
    return this._approval.model.postApproval.create({ data });
  }

  getPendingOfPosts(org: string, postIds: string[]) {
    return this._approval.model.postApproval.findMany({
      where: {
        organizationId: org,
        status: 'pending',
        postIds: { hasSome: postIds },
      },
    });
  }

  replace(ids: string[]) {
    return this._approval.model.postApproval.updateMany({
      where: { id: { in: ids }, status: 'pending' },
      data: { status: 'replaced' },
    });
  }

  getByToken(token: string) {
    return this._approval.model.postApproval.findUnique({ where: { token } });
  }

  // only a link still waiting is answered, a second answer is refused
  answer(id: string, status: 'approved' | 'revision', note?: string) {
    return this._approval.model.postApproval.updateMany({
      where: { id, status: 'pending' },
      data: { status, note: note || null, respondedAt: new Date() },
    });
  }

  getApprovals(org: string, status?: string, postId?: string) {
    return this._approval.model.postApproval.findMany({
      where: {
        organizationId: org,
        ...(status ? { status } : {}),
        ...(postId ? { postIds: { has: postId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
