import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chri_checkeritem')
export class ChriCheckerItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychrt!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myusi!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mycap!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  description!: string;
}
