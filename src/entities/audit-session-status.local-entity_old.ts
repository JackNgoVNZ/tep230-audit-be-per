import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_session_status_old')
export class AuditSessionStatus {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 512, unique: true })
  chpi_code!: string;

  @Column({ type: 'varchar', length: 32 })
  audit_type!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: string;

  @Column({ type: 'real', nullable: true })
  total_score!: number | null;

  @Column({ type: 'real', default: 5.00 })
  max_score!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  threshold_result!: string | null;

  @Column({ type: 'integer', default: 0 })
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

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
