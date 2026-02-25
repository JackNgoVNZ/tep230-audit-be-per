import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_cuie_cuievent')
export class CuieCuiEvent {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 256, unique: true, nullable: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  mycui!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mylcet_lceventtype!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mystep!: string;

  @Column({ type: 'datetime', nullable: true })
  trigger_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  eventplantime!: Date;

  @Column({ type: 'datetime', nullable: true })
  eventactualtime_fet!: Date;

  @Column({ type: 'datetime', nullable: true })
  eventactualtime_bet!: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myusi!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  mybpe!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  planbpe!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  actualbpe!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  publishbpe!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  unpublishbpe!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  value1!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  value2!: string;

  @Column({ type: 'boolean', default: true })
  published!: boolean;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;
}
