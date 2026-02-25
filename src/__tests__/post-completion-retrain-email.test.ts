jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import { AppDataSource } from '../config/database';
import { ScoringService } from '../modules/scoring/scoring.service';
import { EmailService } from '../modules/email/email.service';

const mockQuery = AppDataSource.query as jest.Mock;

jest.spyOn(EmailService.prototype, 'sendEmail');
const sendEmailSpy = EmailService.prototype.sendEmail as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  sendEmailSpy.mockReset();
  sendEmailSpy.mockResolvedValue({ sent: true });
});

const TEACHER = { code: 'USI-TE001', fullname: 'Nguyen Van A', email: 'a@clevai.vn' };
const MGR_USERS = [
  { code: 'USI-MGR01', fullname: 'Manager 1', email: 'mgr1@clevai.vn' },
  { code: 'USI-MGR02', fullname: 'Manager 2', email: 'mgr2@clevai.vn' },
];
const ADM_USERS = [
  { code: 'USI-ADM01', fullname: 'Admin 1', email: 'adm1@clevai.vn' },
];

function setupRetrainMocks() {
  // 1. teacher query
  mockQuery.mockResolvedValueOnce([TEACHER]);
  // 2. MGR users query
  mockQuery.mockResolvedValueOnce(MGR_USERS);
  // 3. ADM users query
  mockQuery.mockResolvedValueOnce(ADM_USERS);
}

describe('handlePostCompletion — RETRAIN case', () => {
  const service = new ScoringService();

  it('RETRAIN on ONBOARD sends email with template RETRAINING', async () => {
    setupRetrainMocks();

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'RETRAIN', 2.5);

    const calls = sendEmailSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0].templateCode).toBe('RTR-AUDIT');
  });

  it('Email sent to teacher (GV)', async () => {
    setupRetrainMocks();

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'RETRAIN', 2.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'a@clevai.vn',
        recipientName: 'Nguyen Van A',
        templateCode: 'RTR-AUDIT',
      }),
    );
  });

  it('Email also sent to all MGR (TO) users', async () => {
    setupRetrainMocks();

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'RETRAIN', 2.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'mgr1@clevai.vn' }),
    );
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'mgr2@clevai.vn' }),
    );
  });

  it('Email also sent to all ADM (AD) users', async () => {
    setupRetrainMocks();

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'RETRAIN', 2.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'adm1@clevai.vn' }),
    );
  });

  it('RETRAIN on RETRAINING type does NOT send retraining email', async () => {
    // Only teacher query (no MGR/ADM since RETRAIN on RETRAINING is excluded)
    mockQuery.mockResolvedValueOnce([TEACHER]);

    await service.handlePostCompletion('CHPI_001', 'RTR-AUDIT', 'RETRAIN', 2.5);

    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  it('Email failure does not block completion', async () => {
    mockQuery.mockResolvedValueOnce([TEACHER]);
    mockQuery.mockResolvedValueOnce(MGR_USERS);
    mockQuery.mockResolvedValueOnce(ADM_USERS);
    sendEmailSpy.mockRejectedValue(new Error('SMTP down'));

    await expect(
      service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'RETRAIN', 2.5),
    ).resolves.not.toThrow();
  });
});
