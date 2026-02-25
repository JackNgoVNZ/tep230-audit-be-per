export function generateCode(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// CHPI: {myulc}_{mychpttype}_{mytrigger}_{ts}
export function generateAuditProcessCode(
  myulc: string | null,
  mychpttype: string,
  mytrigger: string,
): string {
  const ts = Date.now().toString(36);
  return [myulc || 'NA', mychpttype, mytrigger, ts].join('_');
}

// CHSI: {mychst}_S{nn}_{ts}
export function generateAuditStepCode(
  mychst: string,
  stepIndex: number,
): string {
  const ts = Date.now().toString(36);
  return [mychst, `S${String(stepIndex).padStart(2, '0')}`, ts].join('_');
}

// CHLI: {mytrigger}_{mychpttype}_{mychst_last20}_S{nn}_I{nn}_{ts}
export function generateChecklistCode(
  mytrigger: string,
  mychpttype: string,
  mychst: string,
  stepIndex: number,
  itemIndex: number,
): string {
  const ts = Date.now().toString(36);
  const chstShort = mychst.length > 20 ? mychst.slice(-20) : mychst;
  return [mytrigger, mychpttype, chstShort, `S${String(stepIndex).padStart(2, '0')}`, `I${String(itemIndex).padStart(2, '0')}`, ts].join('_');
}
