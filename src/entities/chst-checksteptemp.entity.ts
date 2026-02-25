import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chst_checksteptemp')
export class ChstCheckStepTemp {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 128 })
  mychpt!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychlt!: string;

  @Column({ type: 'int', nullable: true })
  checksample!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mychrt!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', nullable: true, default: true })
  published!: boolean;
}
