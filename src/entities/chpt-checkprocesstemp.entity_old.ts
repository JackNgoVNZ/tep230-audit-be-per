import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_chpt_checkprocesstemp')
export class ChptCheckProcessTemp {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 128, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'varchar', length: 128 })
  mylcp!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  myparentlcet!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mylcet!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  triggerusertype!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  supust!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  timebase!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  timeoffsetunit!: string;

  @Column({ type: 'int', nullable: true })
  timeoffsetvalue!: number;

  @Column({ type: 'int', nullable: true })
  timeoffsetminutes!: number;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  note!: string;

  @Column({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', default: true })
  published!: boolean;
}
