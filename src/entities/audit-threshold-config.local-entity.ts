import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('audit_threshold_config')
export class AuditThresholdConfig {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 32 })
  audit_type!: string;

  @Column({ type: 'varchar', length: 32 })
  threshold_type!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  min_score!: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  max_score!: number | null;

  @Column({ type: 'int', default: 0 })
  has_second_audit!: number;

  @Column({ type: 'int', default: 0 })
  has_unreg4!: number;

  @Column({ type: 'int', default: 1 })
  published!: number;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
