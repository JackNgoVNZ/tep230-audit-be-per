import { localQuery } from '../../config/local-query';
import type { SendEmailInput, CreateTemplateInput, UpdateTemplateInput } from './email.schema';

export class EmailService {
  async listTemplates() {
    return localQuery('SELECT * FROM audit_email_template ORDER BY created_at DESC');
  }

  async createTemplate(input: CreateTemplateInput) {
    const existing = await localQuery(
      'SELECT id FROM audit_email_template WHERE code = ?',
      [input.code]
    );
    if (existing.length) {
      const err: any = new Error('Template code already exists');
      err.statusCode = 400;
      throw err;
    }

    await localQuery(
      `INSERT INTO audit_email_template
       (code, name, subject, body_html, audit_type, trigger_status, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [input.code, input.name, input.subject, input.bodyHtml,
       input.auditType || null, input.triggerStatus || null]
    );

    return { code: input.code, name: input.name, created: true };
  }

  async updateTemplate(id: number, input: UpdateTemplateInput) {
    const rows = await localQuery(
      'SELECT * FROM audit_email_template WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      const err: any = new Error('Email template not found');
      err.statusCode = 404;
      throw err;
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    if (input.name !== undefined) { setClauses.push('name = ?'); params.push(input.name); }
    if (input.subject !== undefined) { setClauses.push('subject = ?'); params.push(input.subject); }
    if (input.bodyHtml !== undefined) { setClauses.push('body_html = ?'); params.push(input.bodyHtml); }
    if (input.auditType !== undefined) { setClauses.push('audit_type = ?'); params.push(input.auditType); }
    if (input.triggerStatus !== undefined) { setClauses.push('trigger_status = ?'); params.push(input.triggerStatus); }
    if (input.published !== undefined) { setClauses.push('published = ?'); params.push(input.published); }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = NOW()");
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

  async sendEmail(input: SendEmailInput) {
    const templateRows = await localQuery(
      'SELECT * FROM audit_email_template WHERE code = ? AND published = 1',
      [input.templateCode]
    );
    if (!templateRows.length) {
      const err: any = new Error('Email template not found');
      err.statusCode = 404;
      throw err;
    }

    const template = templateRows[0];
    let subject = template.subject;
    let body = template.body_html;

    if (input.variables) {
      for (const [key, value] of Object.entries(input.variables)) {
        const placeholder = `{{${key}}}`;
        subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        body = body.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
      }
    }

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
}
