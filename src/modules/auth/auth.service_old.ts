import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../config/database';
import { UsiUserItem } from '../../entities/usi-useritem.entity';
import { UstUserType } from '../../entities/ust-usertype.entity';
import { jwtConfig } from '../../config/jwt';
import { AppError } from '../../middleware/error-handler.middleware';
import { AuthUser } from '../../common/types/request';

// Map Clevai UST codes to audit system roles
const UST_ROLE_MAP: Record<string, string> = {
  MN: 'AD',   // Main user → Admin
  LD: 'TO',   // Lead → Manager
  QO: 'QS',   // Question Operator → QA Leader
  SO: 'QA',    // Staff Operations → QA Auditor
  TE: 'TE',    // Teacher
};

function mapUstToRole(ustCode: string): string {
  return UST_ROLE_MAP[ustCode] || 'TE';
}

// Dev/demo accounts for development environment (no DB dependency)
const DEV_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  admin: {
    password: 'audit@2024',
    user: { id: 999001, code: 'AUDIT_ADMIN', name: 'Audit Administrator', email: 'admin@clevai.edu.vn', role: 'AD' },
  },
  manager: {
    password: 'audit@2024',
    user: { id: 999002, code: 'AUDIT_MGR', name: 'Audit Manager', email: 'manager@clevai.edu.vn', role: 'TO' },
  },
  qaleader: {
    password: 'audit@2024',
    user: { id: 999003, code: 'AUDIT_QAL', name: 'QA Leader', email: 'qal@clevai.edu.vn', role: 'QS' },
  },
  auditor: {
    password: 'audit@2024',
    user: { id: 999004, code: 'AUDIT_QA', name: 'QA Auditor', email: 'qa@clevai.edu.vn', role: 'QA' },
  },
};

async function verifyPassword(input: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  // bcrypt hash starts with $2b$ or $2a$
  if (stored.startsWith('$2b$') || stored.startsWith('$2a$')) {
    return bcrypt.compare(input, stored);
  }
  // MD5 hash (32 hex chars)
  if (/^[a-f0-9]{32}$/i.test(stored)) {
    return crypto.createHash('md5').update(input).digest('hex') === stored.toLowerCase();
  }
  // Plaintext comparison
  return input === stored;
}

export class AuthService {
  private usiRepo = AppDataSource.getRepository(UsiUserItem);
  private ustRepo = AppDataSource.getRepository(UstUserType);

  async login(username: string, password: string) {
    // Check dev accounts first (development environment only)
    const devAccount = DEV_ACCOUNTS[username];
    if (devAccount && password === devAccount.password) {
      const payload = devAccount.user;
      const accessToken = jwt.sign(payload, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn as number,
      });
      const refreshToken = jwt.sign({ id: payload.id, code: payload.code }, jwtConfig.refreshSecret, {
        expiresIn: jwtConfig.refreshExpiresIn as number,
      });
      return { accessToken, refreshToken, user: payload };
    }

    // Check database users
    const user = await this.usiRepo
      .createQueryBuilder('usi')
      .addSelect('usi.password')
      .where('usi.username = :username', { username })
      .andWhere('usi.active = 1')
      .getOne();

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValid = await verifyPassword(password, user.password || '');
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const ust = await this.ustRepo.findOne({ where: { code: user.myust } });
    const role = ust ? mapUstToRole(ust.code) : 'TE';

    const payload: AuthUser = {
      id: user.id,
      code: user.code,
      name: user.fullname || user.displayname || user.username,
      email: user.email || user.clevai_email || '',
      role,
    };

    const accessToken = jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn as number,
    });

    const refreshToken = jwt.sign({ id: user.id, code: user.code }, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn as number,
    });

    return { accessToken, refreshToken, user: payload };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as { id: number; code: string };

      const user = await this.usiRepo.findOne({ where: { id: decoded.id, active: true } });
      if (!user) {
        throw new AppError('User not found or inactive', 401);
      }

      const ust = await this.ustRepo.findOne({ where: { code: user.myust } });
      const role = ust ? mapUstToRole(ust.code) : 'TE';

      const payload: AuthUser = {
        id: user.id,
        code: user.code,
        name: user.fullname || user.displayname || user.username,
        email: user.email || user.clevai_email || '',
        role,
      };

      const newAccessToken = jwt.sign(payload, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn as number,
      });

      return { accessToken: newAccessToken, user: payload };
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async getProfile(userId: number) {
    const user = await this.usiRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const ust = await this.ustRepo.findOne({ where: { code: user.myust } });
    const role = ust ? mapUstToRole(ust.code) : 'TE';

    return {
      id: user.id,
      code: user.code,
      username: user.username,
      fullname: user.fullname,
      displayname: user.displayname,
      email: user.email,
      clevai_email: user.clevai_email,
      phone: user.phone,
      avatar: user.avatar,
      role,
      ustCode: user.myust,
      ustName: ust?.name || '',
      active: user.active,
      created_at: user.created_at,
    };
  }
}
