import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chsi_checkstepitem')
export class ChsiCheckStepItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  checksample!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychpi!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychri!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychst!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  description!: string;
}
