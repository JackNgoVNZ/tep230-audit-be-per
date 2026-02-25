jest.mock('../config/database', () => ({
  AppDataSource: { isInitialized: true, query: jest.fn() },
}));
jest.mock('../config/local-database', () => ({
  LocalDataSource: { isInitialized: true, query: jest.fn() },
}));

import { AppDataSource } from '../config/database';
import { LocalDataSource } from '../config/local-database';
import { ScoringService } from '../modules/scoring/scoring.service';
import { EmailService } from '../modules/email/email.service';

const mockQuery = AppDataSource.query as jest.Mock;
const mockLocalQuery = (LocalDataSource as any).query as jest.Mock;

jest.spyOn(EmailService.prototype, 'sendEmail');
const sendEmailSpy = EmailService.prototype.sendEmail as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  mockLocalQuery.mockReset();
  sendEmailSpy.mockReset();
  sendEmailSpy.mockResolvedValue({ sent: true });
});

describe('handlePostCompletion — PASS case', () => {
  const service = new ScoringService();

  it('PASS result calls EmailService.sendEmail with template PASS', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USI-TE001', fullname: 'Nguyen Van A', email: 'a@clevai.vn' }]);

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'PASS', 3.5);

    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ templateCode: 'PASS' }),
    );
  });

  it('Recipient is teacher email from bp_usi_useritem', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USI-TE001', fullname: 'Nguyen Van A', email: 'a@clevai.vn' }]);

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'PASS', 3.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'a@clevai.vn',
        recipientName: 'Nguyen Van A',
      }),
    );
  });

  it('Variables include teacher_name, audit_type, score', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USI-TE001', fullname: 'Nguyen Van A', email: 'a@clevai.vn' }]);

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'PASS', 3.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          teacher_name: 'Nguyen Van A',
          audit_type: 'ONB-AUDIT',
          score: '3.5',
        }),
      }),
    );
  });

  it('Audit completion succeeds even if email fails (try-catch)', async () => {
    mockQuery.mockResolvedValueOnce([{ code: 'USI-TE001', fullname: 'Nguyen Van A', email: 'a@clevai.vn' }]);
    sendEmailSpy.mockRejectedValueOnce(new Error('SMTP down'));

    // Should not throw
    await expect(
      service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'PASS', 3.5),
    ).resolves.not.toThrow();
  });

  it('Email NOT sent for RETRAIN result', async () => {
    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'RETRAIN', 2.5);

    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  it('Email NOT sent for TERMINATE result', async () => {
    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'TERMINATE', 1.5);

    expect(sendEmailSpy).not.toHaveBeenCalled();
  });
});
