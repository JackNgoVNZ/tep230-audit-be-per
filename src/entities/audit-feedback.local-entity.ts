import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_feedback')
export class AuditFeedback {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 512 })
  chpi_code!: string;

  @Column({ type: 'varchar', length: 128 })
  gv_usi_code!: string;

  @Column({ type: 'text' })
  feedback_text!: string;

  @Column({ type: 'varchar', length: 32 })
  feedback_type!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reviewer_usi_code!: string | null;

  @Column({ type: 'text', nullable: true })
  reviewer_note!: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score_before!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score_after!: number | null;

  @Column({ type: 'datetime', nullable: true })
  reviewed_at!: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
