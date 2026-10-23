import type { D1Binding } from '../../d1-store';
import { noStoreJson } from '../../request';
export interface AdminStatement {
  bind(...values: unknown[]): AdminStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes?: number } }>;
}
export interface AdminDatabase {
  prepare(sql: string): AdminStatement;
  batch(statements: AdminStatement[]): Promise<unknown[]>;
}
export interface AdminEnvironment {
  ADMIN_DB?: AdminDatabase;
  ADMIN_ENVIRONMENT?: 'preview' | 'production';
  CONTROL_DB?: D1Binding;
  CONTROL_POLICY?: string;
  CONTROL_ADMIN_SECRET?: string;
  ADMIN_EMAIL?: string;
  ADMIN_ACCESS_ISSUER?: string;
  ADMIN_ACCESS_AUD?: string;
  ADMIN_CONSOLE_ENABLED?: string;
}
export interface AdminContext<E extends AdminEnvironment = AdminEnvironment> {
  env: E;
  actor: string;
  now: number;
  fresh: boolean;
  requestId: string;
  audit: (action: string, objectId: string, result: string) => Promise<void>;
}
export type TodoLevel = 'alert' | 'warn' | 'info';
export interface AdminTodo {
  id: string;
  level: TodoLevel;
  /** Chinese fallback text; clients translate by `key` + `params` when they know the key. */
  title: string;
  text: string;
  actions: { label: string; href: string; key?: string }[];
  key?: string;
  params?: Record<string, string | number>;
}
export interface TodoSource<C = AdminContext> {
  id: string;
  evaluate: (context: C) => Promise<AdminTodo[]> | AdminTodo[];
}
export const adminJson = (value: unknown, status = 200) => noStoreJson(value, status);
export class AdminError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function requireFreshContext(context: AdminContext) {
  if (!context.fresh) throw new AdminError('FRESH_ACCESS_REQUIRED', 401);
}
export function requireAdminDb(context: AdminContext) {
  if (!context.env.ADMIN_DB) throw new AdminError('ADMIN_UNAVAILABLE', 503);
  return context.env.ADMIN_DB;
}
