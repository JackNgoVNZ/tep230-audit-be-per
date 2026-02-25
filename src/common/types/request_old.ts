import { Request } from 'express';

export interface AuthUser {
  id: number;
  code: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}
