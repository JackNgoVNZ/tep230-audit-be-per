import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_usid_usiduty')
export class UsidUsiDuty {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myusi!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;
}
