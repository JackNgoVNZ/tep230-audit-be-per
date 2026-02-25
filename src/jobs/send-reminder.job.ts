import { AppDataSource } from '../config/database';

export async function sendReminder(): Promise<{ reminders_sent: number }> {
  // 1. Find Assigned sessions older than 24 hours
  const overdueRows = await AppDataSource.query(
    "SELECT code AS chpi_code, mychecker FROM bp_chpi_checkprocessitem WHERE status = 'Assigned' AND created_at <= DATE_SUB(NOW(), INTERVAL 1 DAY)",
  );

  if (!overdueRows || overdueRows.length === 0) {
    console.log(`[SendReminder] Done — date: ${new Date().toISOString().slice(0, 10)}, reminders_sent: 0`);
    return { reminders_sent: 0 };
  }

  let remindersSent = 0;
  for (const row of overdueRows) {
    if (row.mychecker) {
      console.log(`[SendReminder] Reminder for CHPI ${row.chpi_code}, auditor: ${row.mychecker}`);
      remindersSent++;
    }
  }

  console.log(`[SendReminder] Done — date: ${new Date().toISOString().slice(0, 10)}, reminders_sent: ${remindersSent}`);
  return { reminders_sent: remindersSent };
}
