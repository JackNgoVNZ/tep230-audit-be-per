import { Request, Response, NextFunction } from 'express';

export function roles(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Access token required' });
      return;
    }
    if (!allowedRoles.includes(user.myust)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
}
