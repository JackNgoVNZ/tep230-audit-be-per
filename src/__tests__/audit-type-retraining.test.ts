import { createAuditProcessSchema } from '../modules/audit-process/audit-process.schema';
import { AuditType } from '../common/constants_old';

describe('RETRAINING audit type', () => {
  it('AuditType enum contains RETRAINING', () => {
    expect(AuditType.RETRAINING).toBe('RTR-AUDIT');
  });

  it('POST body with audit_type=RETRAINING passes Zod validation', () => {
    const result = createAuditProcessSchema.safeParse({
      cuie_code: 'CUIE-001',
      audit_type: 'RTR-AUDIT',
      trigger_usi_code: 'USI-TE001',
    });
    expect(result.success).toBe(true);
  });

  it('POST body with audit_type=INVALID fails Zod validation', () => {
    const result = createAuditProcessSchema.safeParse({
      cuie_code: 'CUIE-001',
      audit_type: 'INVALID',
      trigger_usi_code: 'USI-TE001',
    });
    expect(result.success).toBe(false);
  });

  it('All original audit types still pass validation', () => {
    for (const type of ['ONB-AUDIT', 'WKL-AUDIT', 'MTL-AUDIT', 'HOT-AUDIT']) {
      const result = createAuditProcessSchema.safeParse({
        cuie_code: 'CUIE-001',
        audit_type: type,
        trigger_usi_code: 'USI-TE001',
      });
      expect(result.success).toBe(true);
    }
  });
});
