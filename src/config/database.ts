import { DataSource } from 'typeorm';
import { UsiUserItem } from '../entities/usi-useritem.entity';
import { UstUserType } from '../entities/ust-usertype.entity';
import { UsidUsiDuty } from '../entities/usid-usiduty.entity';
import { ChptCheckProcessTemp } from '../entities/chpt-checkprocesstemp.entity';
import { ChstCheckStepTemp } from '../entities/chst-checksteptemp.entity';
import { ChltCheckListTemp } from '../entities/chlt-checklisttemp.entity';
import { CuieCuiEvent } from '../entities/cuie-cuievent.entity';
import { ChpiCheckProcessItem } from '../entities/chpi-checkprocessitem.entity';
import { ChsiCheckStepItem } from '../entities/chsi-checkstepitem.entity';
import { ChliCheckListItem } from '../entities/chli-checklistitem.entity';
import { ChriCheckerItem } from '../entities/chri-checkeritem.entity';
import { ChrtCheckerType } from '../entities/chrt-checkertype.entity';
import { LcetLcEventType } from '../entities/lcet-lceventtype.entity';
import { LcpLcPeriod } from '../entities/lcp-lcperiod.entity';
import { CapCalendarPeriod } from '../entities/cap-calendarperiod.entity';
import { AuditSessionStatus } from '../entities/audit-session-status.local-entity';
import { AuditThresholdConfig } from '../entities/audit-threshold-config.local-entity';
import { AuditFeedback } from '../entities/audit-feedback.local-entity';
import { AuditEmailTemplate } from '../entities/audit-email-template.local-entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'mysql.clevai.vn',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER || 'aiagent',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'staging_s2_bp_log_v2',
  entities: [
    UsiUserItem, UstUserType, UsidUsiDuty,
    ChptCheckProcessTemp, ChstCheckStepTemp, ChltCheckListTemp,
    CuieCuiEvent, ChpiCheckProcessItem, ChsiCheckStepItem, ChliCheckListItem,
    ChriCheckerItem, ChrtCheckerType, LcetLcEventType, LcpLcPeriod, CapCalendarPeriod,
    AuditSessionStatus, AuditThresholdConfig, AuditFeedback, AuditEmailTemplate,
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  charset: 'utf8mb4',
  extra: {
    connectionLimit: 25,
  },
});
