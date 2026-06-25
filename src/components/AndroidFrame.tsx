/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AndroidFrameProps {
  children: React.ReactNode;
}

/**
 * AndroidFrame — Root layout wrapper.
 * Sets up the full-viewport dark automotive container.
 * Status bar chrome is handled natively by Capacitor/Android.
 */
export default function AndroidFrame({ children }: AndroidFrameProps) {
  return (
    <div className="flex flex-col w-full h-full min-h-screen bg-[#0a0c0f] font-sans overflow-hidden select-none">
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
