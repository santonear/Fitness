import base from '../../vite.config';
import { defineConfig } from 'vite';
export default defineConfig({ ...base, cacheDir: '.cache/followup-finish-vite' });
