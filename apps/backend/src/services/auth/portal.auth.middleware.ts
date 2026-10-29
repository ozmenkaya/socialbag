import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClientsService } from '@gitroom/nestjs-libraries/database/prisma/clients/clients.service';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';

export const PORTAL_COOKIE = 'portal_session';

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

// The customer portal (/musteri) signs its customers in with their own
// session, apart from the users of the agency
@Injectable()
export class PortalAuthMiddleware implements NestMiddleware {
  constructor(private _clientsService: ClientsService) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const session = await this._clientsService.verify(req.cookies?.[PORTAL_COOKIE]);
    if (!session) {
      res.status(HttpStatus.UNAUTHORIZED).json({ msg: 'Not signed in' });
      return;
    }

    // @ts-ignore
    req.portalClient = session.client;
    // @ts-ignore
    req.portalRemember = session.remember;
    next();
  }
}
