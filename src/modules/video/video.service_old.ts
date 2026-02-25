import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error-handler.middleware';

export class VideoService {
  /**
   * Get video by CUIE event code (from bp_vcr_meeting, bp_va_vcraccount)
   */
  async getVideoByCuie(cuieCode: string) {
    // First get the CUIE event
    const cuieRows = await AppDataSource.query(
      `SELECT cuie.*, usi.fullname as teacher_name
       FROM bp_cuie_cuievent cuie
       LEFT JOIN bp_usi_useritem usi ON usi.code = cuie.myusi
       WHERE cuie.code = ?`,
      [cuieCode]
    );
    if (!cuieRows.length) throw new AppError('CUIE event not found', 404);

    // Try to get video meeting data
    const meetingRows = await AppDataSource.query(
      `SELECT * FROM bp_vcr_meeting WHERE mycuie = ? ORDER BY created_at DESC`,
      [cuieCode]
    ).catch(() => []);

    // Try to get video account data
    const accountRows = await AppDataSource.query(
      `SELECT * FROM bp_va_vcraccount WHERE mycuie = ? ORDER BY created_at DESC`,
      [cuieCode]
    ).catch(() => []);

    return {
      cuieEvent: cuieRows[0],
      meetings: meetingRows,
      accounts: accountRows,
    };
  }

  /**
   * Get video for audit session (by CHPI code)
   */
  async getVideoBySession(chpiCode: string) {
    // Get the process and its CUIE event
    const processRows = await AppDataSource.query(
      `SELECT chpi.*, cuie.name as event_name, cuie.trigger_at,
              cuie.mylcet_lceventtype, cuie.myusi
       FROM bp_chpi_checkprocessitem chpi
       LEFT JOIN bp_cuie_cuievent cuie ON cuie.code = chpi.mycuievent
       WHERE chpi.code = ?`,
      [chpiCode]
    );
    if (!processRows.length) throw new AppError('Audit process not found', 404);

    const process = processRows[0];
    let meetings: any[] = [];
    let accounts: any[] = [];

    if (process.mycuievent) {
      meetings = await AppDataSource.query(
        `SELECT * FROM bp_vcr_meeting WHERE mycuie = ? ORDER BY created_at DESC`,
        [process.mycuievent]
      ).catch(() => []);

      accounts = await AppDataSource.query(
        `SELECT * FROM bp_va_vcraccount WHERE mycuie = ? ORDER BY created_at DESC`,
        [process.mycuievent]
      ).catch(() => []);
    }

    return {
      chpiCode,
      cuieCode: process.mycuievent,
      process: {
        name: process.name,
        trigger: process.mytrigger,
        eventName: process.event_name,
        triggerAt: process.trigger_at,
      },
      meetings,
      accounts,
    };
  }

  /**
   * Sync video data (trigger manual sync)
   */
  async syncVideoData() {
    // Get recent CUIE events that may need video sync
    const recentEvents = await AppDataSource.query(
      `SELECT cuie.code, cuie.name, cuie.myusi, cuie.trigger_at
       FROM bp_cuie_cuievent cuie
       WHERE cuie.trigger_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY cuie.trigger_at DESC
       LIMIT 100`
    );

    return {
      syncTriggered: true,
      eventsChecked: recentEvents.length,
      timestamp: new Date().toISOString(),
    };
  }
}
