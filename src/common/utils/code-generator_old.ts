export function generateCode(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

export function generateAuditProcessCode(auditType: string, gvCode: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 6);
  return `CHPI_${auditType}_${gvCode}_${date}_${random}`;
}

export function generateAuditStepCode(chpiCode: string, stepIndex: number): string {
  return `CHSI_${chpiCode}_S${String(stepIndex).padStart(2, '0')}`;
}

export function generateChecklistCode(chsiCode: string, itemIndex: number): string {
  return `CHLI_${chsiCode}_I${String(itemIndex).padStart(3, '0')}`;
}
