import { sql } from 'drizzle-orm';
import { customType, datetime } from 'drizzle-orm/mysql-core';

/** DATETIME with millisecond precision. The pool reads and writes UTC. */
export const dateTime = (name: string) => datetime(name, { mode: 'date', fsp: 3 });

export const createdAt = () => dateTime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(3)`);

export const updatedAt = () =>
  dateTime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(3)`).$onUpdate(() => new Date());

/** Up to 16MB of binary data */
export const mediumblob = customType<{ data: Buffer }>({ dataType: () => 'mediumblob' });
