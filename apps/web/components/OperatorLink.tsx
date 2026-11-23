'use client';

import type { AnchorHTMLAttributes } from 'react';
import { useOperatorLinkTarget } from '../lib/link-target';

/**
 * A link that leaves for an operator's website from a server-rendered page (the operator page's official-site link):
 * in this tab on the phone layout, in a new tab on the wide one (lib/link-target), never with a Referer.
 */
export function OperatorLink(props: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'>) {
  return <a {...props} target={useOperatorLinkTarget()} rel="noopener noreferrer" />;
}
