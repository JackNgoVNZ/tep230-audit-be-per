import { AuthUser } from './request';

declare global {
  namespace Express {
    interface User extends AuthUser {}
  }
}

export {};
