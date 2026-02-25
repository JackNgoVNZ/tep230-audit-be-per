import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_email_template')
export class AuditEmailTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 512 })
  subject!: string;

  @Column({ type: 'text' })
  body_html!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  audit_type!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  trigger_status!: string | null;

  @Column({ type: 'int', default: 1 })
  published!: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
