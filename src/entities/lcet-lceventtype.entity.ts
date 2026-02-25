import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_lcet_learningcomponenteventtype')
export class LcetLcEventType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myparent!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  level!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;
}
