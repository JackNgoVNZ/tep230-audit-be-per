import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_session_status')
export class AuditSessionStatus {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 512, unique: true })
  chpi_code!: string;

  @Column({ type: 'varchar', length: 32 })
  audit_type!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  total_score!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0 })
  max_score!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  threshold_result!: string | null;

  @Column({ type: 'int', default: 0 })
  is_second_audit!: number;

  @Column({ type: 'int', nullable: true })
  parent_session_id!: number | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  inherited_from_weekly!: string | null;

  @Column({ type: 'datetime', nullable: true })
  assigned_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  scheduled_date!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  supervisor_code!: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
