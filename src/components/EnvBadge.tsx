import { IS_TEST_ENV } from '../config/env';

/** Always-visible "TEST" tag in test builds, so nobody mistakes them for production. */
const EnvBadge: React.FC = () =>
  IS_TEST_ENV ? (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-[calc(var(--ion-safe-area-top)+4px)] left-1/2 z-[100000] -translate-x-1/2 rounded-full bg-warning px-2 text-badge text-white uppercase"
    >
      Test
    </div>
  ) : null;

export default EnvBadge;
