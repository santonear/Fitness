import { z } from 'zod';

// Imported first by main.tsx: skip zod's eval probe, which the site's CSP forbids and would log as a violation.
z.config({ jitless: true });
