import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chli_checklistitem')
export class ChliCheckListItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 512, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subcode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mychsi!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  myparentchlt!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mysubchlt!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  myparentchli!: string;

  @Column({ name: 'do', type: 'varchar', length: 128, nullable: true })
  do!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  donot!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  correctexample!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  incorrectexample!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scoretype1!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  score1!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scoretype2!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  score2!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  status!: string;

  @Column({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  description!: string;
}
