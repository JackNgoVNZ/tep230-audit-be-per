import { AppDataSource } from '../../config/database';

export class VideoService {
  /**
   * Get all video links for an audit session (CHPI).
   * mycti1 = slide link (SSTE), mycti2 = JSON array of video URLs (VCR)
   * If mycti2 is available, parse directly; otherwise query VCR on-demand.
   */
  async getVideoBySession(chpiCode: string) {
    // 1. Get CHPI record
    const chpiRows = await AppDataSource.query(
      'SELECT code, mycti1, mycti2, mycti3, description, myulc, myclag, mytrigger FROM bp_chpi_checkprocessitem WHERE code = ?',
      [chpiCode]
    );

    if (!chpiRows || chpiRows.length === 0) {
      const err: any = new Error('CHPI not found');
      err.statusCode = 404;
      throw err;
    }

    const chpi = chpiRows[0];
    let videos: any[] = [];

    // 2. Try to parse video URLs from mycti2 (JSON array stored at creation)
    if (chpi.mycti2) {
      try {
        const urls: string[] = JSON.parse(chpi.mycti2);
        videos = urls.map((url, idx) => ({ url, name: `Video ${idx + 1}` }));
      } catch {
        // mycti2 not valid JSON — fallback to VCR query
        videos = await this.getVideosByVcr(chpi.mytrigger, chpi.myulc);
      }
    } else if (chpi.myulc && chpi.mytrigger) {
      // mycti2 is NULL — query VCR on-demand
      videos = await this.getVideosByVcr(chpi.mytrigger, chpi.myulc);
    }

    return {
      chpiCode: chpi.code,
      cuieCode: chpi.description || null,
      slideLink: chpi.mycti1 || null,
      videos,
    };
  }

  /**
   * Get all video links for a CUIE event.
   * Resolves myulc + teacher from cuie_details, then queries VCR.
   */
  async getVideoByCuie(cuieCode: string) {
    // 1. Get CUIE event info
    const cuieRows = await AppDataSource.query(
      `SELECT mycuie AS code, usi_full_name AS name, myusi, trigger_at, myulc, myclag
       FROM staging_s2_parent_report_db.bp_cuie_details WHERE mycuie = ? LIMIT 1`,
      [cuieCode]
    );

    if (!cuieRows || cuieRows.length === 0) {
      const err: any = new Error('CUIE event not found');
      err.statusCode = 404;
      throw err;
    }

    const cuie = cuieRows[0];

    // 2. Get video links via VCR query
    const videos = await this.getVideosByVcr(cuie.myusi, cuie.myulc);

    // 3. Get teacher name
    let teacherName = '';
    if (cuie.myusi) {
      const teacherRows = await AppDataSource.query(
        'SELECT fullname FROM bp_usi_useritem WHERE code = ?',
        [cuie.myusi]
      );
      if (teacherRows && teacherRows.length > 0) {
        teacherName = teacherRows[0].fullname;
      }
    }

    return {
      cuieCode: cuie.code,
      cuieName: cuie.name,
      teacher_name: teacherName,
      trigger_at: cuie.trigger_at,
      videos,
    };
  }

  /**
   * Query video links from VCR tables (bp_usi_vcr_meeting + bp_vcr_meeting).
   * Uses COALESCE logic: if vcr.code contains '-', use vcr.view_url; otherwise use cti.starturl.
   * Falls back to vcr.view_url if cti.starturl is NULL.
   */
  private async getVideosByVcr(teacherCode: string, myulc: string): Promise<any[]> {
    if (!teacherCode || !myulc) return [];

    const vcrRows = await AppDataSource.query(
      `SELECT COALESCE(
          IF(vcr.code LIKE '%-%', vcr.view_url, cti.starturl),
          vcr.view_url
       ) AS view_url
       FROM bp_usi_vcr_meeting uvm
       JOIN bp_ulc_uniquelearningcomponent ulc ON uvm.myulc = ulc.code
       JOIN bp_cap_calendarperiod cap ON ulc.mycap = cap.code
       JOIN bp_vcr_meeting vcr ON vcr.code = uvm.myvcr
       LEFT JOIN bp_cti_contentitem cti
           ON vcr.code NOT LIKE '%-%'
          AND DATE(vcr.start_time) = DATE(cti.created_at)
          AND vcr.clag_code = cti.secretkey
       WHERE uvm.myusi = ? AND uvm.myulc = ?
       ORDER BY DATE(cap.startperiod) DESC`,
      [teacherCode, myulc]
    );

    return (vcrRows || [])
      .filter((r: any) => r.view_url != null && r.view_url !== '')
      .map((r: any, idx: number) => ({
        url: r.view_url,
        name: `Video ${idx + 1}`,
      }));
  }
}
