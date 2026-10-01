import type { ClientJwtPayload, JwtPayload } from '../lib/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
      clientAuth?: ClientJwtPayload;
    }
  }
}

export {};
