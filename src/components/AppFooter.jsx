import React from 'react';
import { APP_VERSION } from '../utils/version';

/** Footer ramping + nomor versi — acuan saat lapor kendala ("saya pakai vX"). */
const AppFooter = () => (
  <footer className="py-6">
    <p className="text-center text-xs text-gray-400">
      © 2026 Mutiari Garden • v{APP_VERSION}
    </p>
  </footer>
);

export default AppFooter;
