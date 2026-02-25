import { AppDataSource } from '../../config/database';
import { localQuery } from '../../config/local-query';
import { EmailService } from '../email/email.service';
import {
  generateAuditProcessCode,
  generateAuditStepCode,
  generateChecklistCode,
} from '../../common/utils/code-generator';

export class ScoringService {
  async calculateScore(chpiCode: string) {
    // Verify process exists
    const processRows = await AppDataSource.query(
      'SELECT code FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode]
    );
    if (!processRows.length) {
      throw { statusCode: 404, message: 'Audit process not found' };
    }

    // Calculate: SUM actual scores / SUM template max scores * 5.0
    const scoreResult = await AppDataSource.query(
      `SELECT
        SUM(CAST(chli.score1 AS DECIMAL(10,2))) as total_actual,
        SUM(CAST(chlt.score1 AS DECIMAL(10,2))) as total_max,
        COUNT(chli.code) as total_items,
        SUM(CASE WHEN chli.score1 IS NOT NULL THEN 1 ELSE 0 END) as scored_items
       FROM bp_chli_checklistitem chli
       INNER JOIN bp_chsi_checkstepitem chsi ON chsi.code = chli.mychsi
       LEFT JOIN bp_chlt_checklisttemp chlt ON chlt.code = chli.mysubchlt
       WHERE chsi.mychpi = ?`,
      [chpiCode]
    );

    const totalActual = parseFloat(scoreResult[0]?.total_actual) || 0;
    const totalMax = parseFloat(scoreResult[0]?.total_max) || 0;
    const totalItems = parseInt(scoreResult[0]?.total_items) || 0;
    const scoredItems = parseInt(scoreResult[0]?.scored_items) || 0;

    let finalScore = 0;
    if (totalMax > 0) {
      finalScore = Math.round((totalActual / totalMax) * 5.0 * 100) / 100;
    }

    return {
      chpiCode,
      totalActual,
      totalMax,
      finalScore,
      maxScore: 5.0,
      totalItems,
      scoredItems,
    };
  }

  async checkThreshold(chpiCode: string) {
    // Get audit type from MySQL CHPI
    const chpiRows = await AppDataSource.query(
      'SELECT code, mychpttype, status FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode]
    );
    if (!chpiRows.length) {
      throw { statusCode: 404, message: 'Audit session not found' };
    }
    const chpi = chpiRows[0];

    // Calculate score
    const scoreData = await this.calculateScore(chpiCode);

    // Get threshold configs for this audit type
    const thresholds = await localQuery(
      `SELECT * FROM audit_threshold_config
       WHERE audit_type = ? AND published = 1
       ORDER BY min_score ASC`,
      [chpi.mychpttype]
    );

    let thresholdResult = 'PASS';

    for (const threshold of thresholds) {
      const minScore = threshold.min_score !== null ? parseFloat(threshold.min_score) : null;
      const maxScore = threshold.max_score !== null ? parseFloat(threshold.max_score) : null;

      // Check if score falls in this range
      const aboveMin = minScore === null || scoreData.finalScore >= minScore;
      const belowMax = maxScore === null || scoreData.finalScore < maxScore;

      if (aboveMin && belowMax) {
        thresholdResult = threshold.threshold_type;
        break;
      }
    }

    return {
      chpiCode,
      auditType: chpi.mychpttype,
      finalScore: scoreData.finalScore,
      thresholdResult,
    };
  }

  async completeAudit(chpiCode: string, items?: { chli_code: string; score1: number; reason: string }[]) {
    // 1. Save scores if provided (from frontend submit)
    if (items && items.length > 0) {
      const codes = items.map(i => i.chli_code);
      const placeholders = codes.map(() => '?').join(',');
      const scoreWhen = items.map(() => 'WHEN code = ? THEN ?').join(' ');
      const scoreParams: any[] = [];
      for (const item of items) { scoreParams.push(item.chli_code, String(item.score1)); }
      const descWhen = items.map(() => 'WHEN code = ? THEN ?').join(' ');
      const descParams: any[] = [];
      for (const item of items) { descParams.push(item.chli_code, item.reason ?? ''); }
      await AppDataSource.query(
        `UPDATE bp_chli_checklistitem SET score1 = CASE ${scoreWhen} END, description = CASE ${descWhen} END, updated_at = NOW() WHERE code IN (${placeholders})`,
        [...scoreParams, ...descParams, ...codes]
      );
    }

    // 2. Validate all items scored
    const scoreData = await this.calculateScore(chpiCode);
    if (scoreData.scoredItems < scoreData.totalItems) {
      throw {
        statusCode: 400,
        message: `Not all items scored (${scoreData.totalItems - scoreData.scoredItems} remaining)`,
      };
    }

    // 3. CASCADE bottom-up: CHLI → 'Audited'
    await AppDataSource.query(
      `UPDATE bp_chli_checklistitem SET status = 'Audited'
       WHERE mychsi IN (SELECT code FROM bp_chsi_checkstepitem WHERE mychpi = ?)
         AND score1 IS NOT NULL`,
      [chpiCode]
    );

    // 4. CASCADE: CHSI → 'Audited' (only if ALL its CHLI are 'Audited')
    await AppDataSource.query(
      `UPDATE bp_chsi_checkstepitem SET status = 'Audited'
       WHERE mychpi = ?
         AND NOT EXISTS (
           SELECT 1 FROM bp_chli_checklistitem
           WHERE mychsi = bp_chsi_checkstepitem.code AND status != 'Audited'
         )`,
      [chpiCode]
    );

    // 5. CASCADE: CHPI → 'Audited' (only if ALL CHSI are 'Audited')
    const incompleteSteps = await AppDataSource.query(
      `SELECT COUNT(*) as cnt FROM bp_chsi_checkstepitem WHERE mychpi = ? AND status != 'Audited'`,
      [chpiCode]
    );
    if (Number(incompleteSteps[0].cnt) === 0) {
      await AppDataSource.query(
        "UPDATE bp_chpi_checkprocessitem SET status = 'Audited' WHERE code = ?",
        [chpiCode]
      );
    }

    // 6. Check threshold
    const thresholdData = await this.checkThreshold(chpiCode);

    // Fire-and-forget post-completion actions
    this.handlePostCompletion(chpiCode, thresholdData.auditType, thresholdData.thresholdResult, scoreData.finalScore).catch(() => {});

    return {
      chpiCode,
      status: 'Audited',
      totalScore: scoreData.finalScore,
      maxScore: 5.0,
      thresholdResult: thresholdData.thresholdResult,
      totalItems: scoreData.totalItems,
      scoredItems: scoreData.scoredItems,
    };
  }

  async handlePostCompletion(chpiCode: string, auditType: string, thresholdResult: string, finalScore: number) {
    try {
      const emailService = new EmailService();

      // Get teacher info (used in PASS and RETRAIN cases)
      const teacherRows = await AppDataSource.query(
        `SELECT u.code, u.fullname, u.email
         FROM bp_usi_useritem u
         INNER JOIN bp_chpi_checkprocessitem chpi ON chpi.mytrigger = u.code
         WHERE chpi.code = ?`,
        [chpiCode]
      );
      const teacher = teacherRows.length ? teacherRows[0] : null;

      if (thresholdResult === 'PASS') {
        if (teacher?.email) {
          await emailService.sendEmail({
            templateCode: 'PASS',
            recipientEmail: teacher.email,
            recipientName: teacher.fullname,
            variables: {
              teacher_name: teacher.fullname || '',
              audit_type: auditType,
              score: String(finalScore),
            },
          });
        }
      } else if (thresholdResult === 'RETRAIN' && auditType !== 'RTR-AUDIT') {
        // Send retraining notification to teacher + all MGR + all ADM
        const variables = {
          teacher_name: teacher?.fullname || '',
          audit_type: auditType,
          score: String(finalScore),
          chpi_code: chpiCode,
        };

        // Send to teacher
        if (teacher?.email) {
          await emailService.sendEmail({
            templateCode: 'RTR-AUDIT',
            recipientEmail: teacher.email,
            recipientName: teacher.fullname,
            variables,
          });
        }

        // Send to all MGR (TO) users
        const mgrUsers = await AppDataSource.query(
          `SELECT u.code, u.fullname, u.email
           FROM bp_usi_useritem u
           INNER JOIN bp_usid_usiduty d ON d.myusi = u.code
           WHERE d.myust = 'TO' AND u.email IS NOT NULL`,
        );
        for (const mgr of mgrUsers) {
          await emailService.sendEmail({
            templateCode: 'RTR-AUDIT',
            recipientEmail: mgr.email,
            recipientName: mgr.fullname,
            variables,
          });
        }

        // Send to all ADM users
        const admUsers = await AppDataSource.query(
          `SELECT u.code, u.fullname, u.email
           FROM bp_usi_useritem u
           INNER JOIN bp_usid_usiduty d ON d.myusi = u.code
           WHERE d.myust = 'AD' AND u.email IS NOT NULL`,
        );
        for (const adm of admUsers) {
          await emailService.sendEmail({
            templateCode: 'RTR-AUDIT',
            recipientEmail: adm.email,
            recipientName: adm.fullname,
            variables,
          });
        }

        // Auto-create retraining audit scheduled 7 days from now
        await this.createRetrainingAudit(chpiCode);
      } else if (auditType === 'RTR-AUDIT' && thresholdResult !== 'PASS') {
        // Failed retraining → send termination email to all MGR (TO) users
        const mgrUsers = await AppDataSource.query(
          `SELECT u.code, u.fullname, u.email
           FROM bp_usi_useritem u
           INNER JOIN bp_usid_usiduty d ON d.myusi = u.code
           WHERE d.myust = 'TO' AND u.email IS NOT NULL`,
        );
        const variables = {
          teacher_name: teacher?.fullname || '',
          audit_type: auditType,
          score: String(finalScore),
          chpi_code: chpiCode,
        };
        for (const mgr of mgrUsers) {
          await emailService.sendEmail({
            templateCode: 'TERMINATION',
            recipientEmail: mgr.email,
            recipientName: mgr.fullname,
            variables,
          });
        }
      }
    } catch {
      // Email failure must not block audit completion
    }
  }

  async createRetrainingAudit(originalChpiCode: string) {
    // Check if retraining already exists for this parent (using MySQL CHPI description reference)
    const existing = await AppDataSource.query(
      `SELECT code FROM bp_chpi_checkprocessitem
       WHERE mychpttype = 'RTR-AUDIT' AND description = ?`,
      [originalChpiCode]
    );
    if (existing.length > 0) return null;

    // Get original CHPI data
    const origRows = await AppDataSource.query(
      `SELECT code, name, mychpt, mychpttype, mylcet, mytrigger, myulc, myclag, description FROM bp_chpi_checkprocessitem WHERE code = ?`,
      [originalChpiCode]
    );
    if (!origRows.length) return null;
    const orig = origRows[0];

    // Generate new CHPI with status='Assigned'
    const newChpiCode = generateAuditProcessCode(
      orig.myulc, 'RTR-AUDIT', orig.mytrigger,
    );
    await AppDataSource.query(
      `INSERT INTO bp_chpi_checkprocessitem
         (code, name, description, mychpt, mychpttype, mylcet, mycuievent, mytrigger, status, created_at)
       VALUES (?, ?, ?, ?, 'RTR-AUDIT', ?, NULL, ?, 'Assigned', NOW())`,
      [newChpiCode, `RTR-AUDIT | ${orig.name}`, originalChpiCode, orig.mychpt, orig.mylcet, orig.mytrigger]
    );

    // Clone CHSI steps from original
    const origSteps = await AppDataSource.query(
      `SELECT code, name, checksample, mychst FROM bp_chsi_checkstepitem WHERE mychpi = ? ORDER BY code`,
      [originalChpiCode]
    );

    for (let si = 0; si < origSteps.length; si++) {
      const step = origSteps[si];
      const newChsiCode = generateAuditStepCode(step.mychst, si + 1);

      await AppDataSource.query(
        `INSERT INTO bp_chsi_checkstepitem (code, name, checksample, mychpi, mychst, myulc, mytrigger, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned', NOW())`,
        [newChsiCode, step.name, step.checksample, newChpiCode, step.mychst, orig.myulc || null, orig.mytrigger || null]
      );

      // Clone CHLI items from original step
      const origItems = await AppDataSource.query(
        `SELECT subcode, name, myparentchlt, mysubchlt, \`do\`, donot, correctexample, incorrectexample,
                scoretype1, score1, scoretype2, score2
         FROM bp_chli_checklistitem WHERE mychsi = ? ORDER BY code`,
        [step.code]
      );

      for (let ci = 0; ci < origItems.length; ci++) {
        const item = origItems[ci];
        const newChliCode = generateChecklistCode(orig.mytrigger || 'NA', 'RTR-AUDIT', step.mychst, si + 1, ci + 1);

        await AppDataSource.query(
          `INSERT INTO bp_chli_checklistitem
             (code, subcode, name, mychsi, myparentchlt, mysubchlt,
              \`do\`, donot, correctexample, incorrectexample,
              scoretype1, score1, scoretype2, score2, myulc, mytrigger, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', NOW())`,
          [newChliCode, item.subcode, item.name, newChsiCode, item.myparentchlt, item.mysubchlt,
           item.do, item.donot, item.correctexample, item.incorrectexample,
           item.scoretype1, null, item.scoretype2, null, orig.myulc || null, orig.mytrigger || null]
        );
      }
    }

    return newChpiCode;
  }
}
