import { COMPANY_API_URL_OVERRIDE, IS_TEST_ENV } from '../config/env';

/**
 * Always-visible tag outside production: "Test" in test builds, "Local" when the
 * dev server talks to a local backend, so nobody mistakes them for production.
 */
const EnvBadge: React.FC = () => {
  const labels = [IS_TEST_ENV && 'Test', COMPANY_API_URL_OVERRIDE && 'Local'].filter(Boolean);
  if (!labels.length) return null;
  return (
    <div
      aria-hidden="true"
      title={COMPANY_API_URL_OVERRIDE || undefined}
      className="pointer-events-none fixed top-[calc(var(--ion-safe-area-top)+4px)] left-1/2 z-[100000] -translate-x-1/2 rounded-full bg-warning px-2 text-badge text-white uppercase"
    >
      {labels.join(' · ')}
    </div>
  );
};

export default EnvBadge;
