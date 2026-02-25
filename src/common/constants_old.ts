export enum AuditType {
  ONBOARD = 'ONB-AUDIT',
  WEEKLY = 'WKL-AUDIT',
  HOTCASE = 'HOT-AUDIT',
  MONTHLY = 'MTL-AUDIT',
  RETRAINING = 'RTR-AUDIT',
}

export enum AuditStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ThresholdResult {
  PASS = 'PASS',
  RETRAIN = 'RETRAIN',
  TERMINATE = 'TERMINATE',
}

export enum FeedbackType {
  DISAGREE = 'DISAGREE',
  CLARIFY = 'CLARIFY',
  APPEAL = 'APPEAL',
}

export enum FeedbackStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum UserRole {
  ADM = 'ADM',
  MGR = 'MGR',
  QAL = 'QAL',
  QA = 'QA',
  TE = 'TE',
}

export enum EmailTrigger {
  COMPLETED = 'COMPLETED',
  RETRAIN = 'RETRAIN',
  TERMINATE = 'TERMINATE',
  REMINDER = 'REMINDER',
}
