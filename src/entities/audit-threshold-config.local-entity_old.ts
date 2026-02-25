import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_threshold_config_old')
export class AuditThresholdConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 32 })
  audit_type!: string;

  @Column({ type: 'varchar', length: 32 })
  threshold_type!: string;

  @Column({ type: 'real', nullable: true })
  min_score!: number | null;

  @Column({ type: 'real', nullable: true })
  max_score!: number | null;

  @Column({ type: 'integer', default: 0 })
  has_second_audit!: number;

  @Column({ type: 'integer', default: 0 })
  has_unreg4!: number;

  @Column({ type: 'integer', default: 1 })
  published!: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
