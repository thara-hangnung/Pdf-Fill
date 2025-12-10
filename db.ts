import Dexie, { Table } from 'dexie';
import { Profile, Template } from './types';

class AutoFormDatabase extends Dexie {
  profiles!: Table<Profile>;
  templates!: Table<Template>;

  constructor() {
    super('AutoFormDB');
    // Cast this to any to resolve TS error: Property 'version' does not exist on type 'AutoFormDatabase'
    // This maintains compatibility with different Dexie type definitions while ensuring runtime works.
    (this as any).version(1).stores({
      profiles: '++id, name',
      templates: '++id, name, createdAt'
    });
  }
}

export const db = new AutoFormDatabase();