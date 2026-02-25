import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_ust_usertype')
export class UstUserType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 64 })
  myusl!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  myparentust!: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  description!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', nullable: true, default: true })
  published!: boolean;
}
