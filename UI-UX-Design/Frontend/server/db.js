// Tiny JSON-file database (no MongoDB/native build needed). Swap for Mongo easily later.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
export const DB_FILE = path.join(dir, 'data.json');
const empty = { users: [], courses: [], modules: [], lessons: [], assignments: [], submissions: [], enrollments: [], sessions: [], attendance: [], completions: [], announcements: [] };
export let db = fs.existsSync(DB_FILE) ? { ...empty, ...JSON.parse(fs.readFileSync(DB_FILE)) } : structuredClone(empty);
export const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
export const reset = () => { db = structuredClone(empty); Object.assign(db, empty); return db; };
export const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
