import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chrt_checkertype')
export class ChrtCheckerType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;
}
