import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chpi_checkprocessitem')
export class ChpiCheckProcessItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 512, unique: true, nullable: true })
  code!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 128 })
  mychpt!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychpttype!: string;

  @Column({ type: 'varchar', length: 128 })
  mylcet!: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  mycuievent!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mytrigger!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychecker!: string;

  @Column({ type: 'text', nullable: true })
  mycti1!: string;

  @Column({ type: 'text', nullable: true })
  mycti2!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mycti3!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myulc!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myclag!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status!: string;

  @Column({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  description!: string;
}
