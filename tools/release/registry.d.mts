export interface Registration { id: string; deploymentId: string; publishedAt: string; compatibleDataVersion?: number; smokeOrigin: string; commit?: string; pr?: number }
export interface RegistryEntry { environment: 'preview' | 'production'; dataVersion: number; current: Registration & { compatibleDataVersion: number }; previous?: Registration }
export const PENDING_DEPLOYMENT_ID: string;
export function pullRequestNumber(subject?: string, explicit?: string): number | undefined;
export function releaseId(sha: string, pr?: number): string;
export function releaseMessage(input: { id: string; sha: string; pr?: number; dataVersion?: number }): string;
export function liveVersionId(deployment: unknown): string | undefined;
export function previousRegistration(deployment: unknown, version: unknown, smokeOrigin: string): Registration | undefined;
export function buildRegistry(input: { environment: string; sha: string; subject?: string; pr?: string; smokeOrigin: string; deployment?: unknown; version?: unknown; now?: Date }): { registry: RegistryEntry[]; message: string; tag: string };
