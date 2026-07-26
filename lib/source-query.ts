import { getDatabase } from './db';
export function listRegisteredSources(domain = 'all') {
  try {
    return getDatabase().prepare(`SELECT id,domain,title,kind,location,checksum,trust,status,updated_at FROM sources WHERE (?='all' OR domain=?) ORDER BY trust DESC,title`).all(domain, domain);
  } catch {
    return [];
  }
}
