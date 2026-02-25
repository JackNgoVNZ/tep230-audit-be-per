import { localQuery } from '../../config/local-query';
import { AppError } from '../../middleware/error-handler.middleware';
import { SendEmailInput, CreateTemplateInput, UpdateTemplateInput } from './email.schema';

export class EmailService {
  /**
   * Send email using template
   */
  async sendEmail(input: SendEmailInput) {
    // Get template
    const templateRows = await localQuery(
      'SELECT * FROM audit_email_template WHERE code = ? AND published = 1',
      [input.templateCode]
    );
    if (!templateRows.length) throw new AppError('Email template not found', 404);

    const template = templateRows[0];

    // Replace variables in subject and body
    let subject = template.subject;
    let body = template.body_html;

    if (input.variables) {
      for (const [key, value] of Object.entries(input.variables)) {
        const placeholder = `{{${key}}}`;
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
        body = body.replace(new RegExp(placeholder, 'g'), value);
      }
    }

    // In production, integrate with actual email service (nodemailer, etc.)
    // For now, log the email details
    console.log(`[EMAIL] To: ${input.recipientEmail}, Subject: ${subject}`);

    return {
      sent: true,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName || null,
      templateCode: input.templateCode,
      subject,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List email templates
   */
  async listTemplates() {
    const data = await localQuery(
      'SELECT * FROM audit_email_template ORDER BY created_at DESC'
    );
    return data;
  }

  /**
   * Create email template
   */
  async createTemplate(input: CreateTemplateInput) {
    // Check if code already exists
    const existing = await localQuery(
      'SELECT id FROM audit_email_template WHERE code = ?',
      [input.code]
    );
    if (existing.length) throw new AppError('Template code already exists', 400);

    await localQuery(
      `INSERT INTO audit_email_template
       (code, name, subject, body_html, audit_type, trigger_status, published, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [input.code, input.name, input.subject, input.bodyHtml,
       input.auditType || null, input.triggerStatus || null]
    );

    return {
      code: input.code,
      name: input.name,
      created: true,
    };
  }

  /**
   * Update email template
   */
  async updateTemplate(id: number, input: UpdateTemplateInput) {
    const rows = await localQuery(
      'SELECT * FROM audit_email_template WHERE id = ?',
      [id]
    );
    if (!rows.length) throw new AppError('Email template not found', 404);

    const setClauses: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) {
      setClauses.push('name = ?');
      params.push(input.name);
    }
    if (input.subject !== undefined) {
      setClauses.push('subject = ?');
      params.push(input.subject);
    }
    if (input.bodyHtml !== undefined) {
      setClauses.push('body_html = ?');
      params.push(input.bodyHtml);
    }
    if (input.auditType !== undefined) {
      setClauses.push('audit_type = ?');
      params.push(input.auditType);
    }
    if (input.triggerStatus !== undefined) {
      setClauses.push('trigger_status = ?');
      params.push(input.triggerStatus);
    }
    if (input.published !== undefined) {
      setClauses.push('published = ?');
      params.push(input.published);
    }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = datetime('now')");
      params.push(id);

      await localQuery(
        `UPDATE audit_email_template SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    }

    const updated = await localQuery(
      'SELECT * FROM audit_email_template WHERE id = ?',
      [id]
    );
    return updated[0];
  }
}
