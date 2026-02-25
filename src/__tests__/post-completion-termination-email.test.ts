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
];

describe('handlePostCompletion — TERMINATE on RETRAINING', () => {
  const service = new ScoringService();

  it('RETRAINING audit with TERMINATE result sends TERMINATION template', async () => {
    // teacher query
    mockQuery.mockResolvedValueOnce([TEACHER]);
    // MGR users query
    mockQuery.mockResolvedValueOnce(MGR_USERS);

    await service.handlePostCompletion('CHPI_RET_001', 'RTR-AUDIT', 'TERMINATE', 1.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ templateCode: 'TERMINATION' }),
    );
  });

  it('RETRAINING audit with RETRAIN result also sends TERMINATION email', async () => {
    mockQuery.mockResolvedValueOnce([TEACHER]);
    mockQuery.mockResolvedValueOnce(MGR_USERS);

    await service.handlePostCompletion('CHPI_RET_001', 'RTR-AUDIT', 'RETRAIN', 2.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ templateCode: 'TERMINATION' }),
    );
  });

  it('Recipients are all MGR (TO) users', async () => {
    mockQuery.mockResolvedValueOnce([TEACHER]);
    mockQuery.mockResolvedValueOnce(MGR_USERS);

    await service.handlePostCompletion('CHPI_RET_001', 'RTR-AUDIT', 'TERMINATE', 1.5);

    expect(sendEmailSpy).toHaveBeenCalledWith(
      expect.objectContaining({ recipientEmail: 'mgr1@clevai.vn' }),
    );
  });

  it('ONBOARD audit with TERMINATE does NOT send termination email', async () => {
    // teacher query (PASS/RETRAIN branches not triggered for TERMINATE on non-RETRAINING)
    mockQuery.mockResolvedValueOnce([TEACHER]);

    await service.handlePostCompletion('CHPI_001', 'ONB-AUDIT', 'TERMINATE', 1.5);

    expect(sendEmailSpy).not.toHaveBeenCalled();
  });
});
