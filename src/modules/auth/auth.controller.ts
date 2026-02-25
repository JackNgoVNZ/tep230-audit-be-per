import { Request, Response } from 'express';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);

      if (!result) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Internal error' });
    }
  }

  me(req: Request, res: Response): void {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }
    res.json({ usi_code: user.usi_code, fullname: user.fullname, myust: user.myust });
  }
}
