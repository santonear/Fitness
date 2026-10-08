import {defineConfig} from '@playwright/test';
import baseline from './playwright.onboarding-v4-regression.config';
export default defineConfig({...baseline,testMatch:[...(baseline.testMatch as string[]),'onboarding-v5.spec.ts','trial-access.spec.ts','admin-account-actions.spec.ts'],outputDir:'outputs/onboarding-v5/regression'});
