import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('bp_usi_useritem')
export class UsiUserItem {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  code!: string;

  @Column({ type: 'varchar', length: 64 })
  username!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password!: string;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  password_salt!: string;

  @Column({ type: 'varchar', length: 64 })
  myust!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  myparent!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstname!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  lastname!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  fullname!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  avatar!: string;

  @Column({ type: 'date', nullable: true })
  birthday!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  job!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string;

  @Column({ type: 'tinyint', nullable: true })
  gender!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayname!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  clevai_email!: string;

  @Column({ type: 'datetime', nullable: true })
  created_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date;

  @Column({ type: 'boolean', nullable: true, default: true })
  active!: boolean;
}
