import { createRoot } from 'react-dom/client';
import { MaintenanceBanner } from '../../src/ui/admin/finance/MaintenanceBanner';
const root = createRoot(document.getElementById('fixture')!);
Object.assign(window, {
  renderBanner: (training = false) => root.render(<MaintenanceBanner training={training} language="zh" />),
});
(window as unknown as { renderBanner: () => void }).renderBanner();
