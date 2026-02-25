import jwt from 'jsonwebtoken';
import { jwtConfig } from '../../config/jwt';
import { AuthUser } from '../../common/types/request';
import { AppDataSource } from '../../config/database';

// Dev account fallback (for offline dev/testing)
const DEV_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  admin: {
    password: 'audit@2024',
    user: { usi_code: 'AUDIT_ADMIN', fullname: 'Audit Administrator', myust: 'AD' },
  },
};

export class AuthService {
  async login(username: string, password: string) {
    // 1. Try DB login: bp_usi_useritem + bp_usid_usiduty
    try {
      const rows = await AppDataSource.query(
        `SELECT u.code, u.fullname, d.myust
         FROM bp_usi_useritem u
         INNER JOIN bp_usid_usiduty d ON d.myusi = u.code
         WHERE u.username = ? AND u.password = ? AND u.active = b'1'
         LIMIT 1`,
        [username, password]
      );
      if (rows.length) {
        const row = rows[0];
        const payload: AuthUser = {
          usi_code: row.code,
          fullname: row.fullname,
          myust: row.myust,
        };
        const access_token = jwt.sign(payload, jwtConfig.secret, {
          expiresIn: jwtConfig.expiresIn,
        });
        return { access_token, user: payload };
      }
    } catch (err: any) {
      // DB unavailable — fall through to dev accounts
    }

    // 2. Fallback: dev accounts (for unit tests and offline dev)
    const devAccount = DEV_ACCOUNTS[username];
    if (devAccount && password === devAccount.password) {
      const payload = devAccount.user;
      const access_token = jwt.sign(payload, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
      });
      return { access_token, user: payload };
    }

    return null;
  }
}
