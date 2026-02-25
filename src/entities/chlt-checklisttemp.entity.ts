import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chlt_checklisttemp')
export class ChltCheckListTemp {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subcode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  myparentchlt!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scoretype!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  score1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scoretype2!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  score2!: string;

  @Column({ name: 'do', type: 'varchar', length: 30, nullable: true })
  do!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  donot!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  correctexample!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  incorrectexample!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mychst!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', nullable: true, default: true })
  published!: boolean;
}
