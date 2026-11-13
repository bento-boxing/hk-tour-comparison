import { useRef } from 'react';
import { it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePopoverDismiss, type DismissReason } from './use-popover-dismiss';

function Popover({ onDismiss }: { onDismiss: (reason: DismissReason) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onKeyDown = usePopoverDismiss(rootRef, onDismiss);
  return (
    <div ref={rootRef} role="dialog" aria-label="popover" onKeyDown={onKeyDown}>
      <button type="button">inside</button>
    </div>
  );
}

let onDismiss: ReturnType<typeof vi.fn<(reason: DismissReason) => void>>;
beforeEach(() => { onDismiss = vi.fn(); });

it('a press outside dismisses with "outside"; a press inside does not', async () => {
  const user = userEvent.setup();
  render(<><p>elsewhere</p><Popover onDismiss={onDismiss} /></>);
  await user.click(screen.getByRole('button', { name: 'inside' }));
  expect(onDismiss).not.toHaveBeenCalled();
  await user.click(screen.getByText('elsewhere'));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledWith('outside');
});

it('Escape inside dismisses with "escape" and stops there', async () => {
  const user = userEvent.setup();
  const outer = vi.fn();
  render(<div onKeyDown={outer}><Popover onDismiss={onDismiss} /></div>);
  screen.getByRole('button', { name: 'inside' }).focus();
  await user.keyboard('{Escape}');
  expect(onDismiss).toHaveBeenCalledWith('escape');
  expect(outer).not.toHaveBeenCalled(); // an enclosing widget does not also react to this Escape
});

it('other keys do nothing', async () => {
  const user = userEvent.setup();
  render(<Popover onDismiss={onDismiss} />);
  screen.getByRole('button', { name: 'inside' }).focus();
  await user.keyboard('a{Enter}{ArrowDown}');
  expect(onDismiss).not.toHaveBeenCalled();
});

it.each([
  ['isComposing', { isComposing: true }],
  ['keyCode 229 (Safari, after compositionend)', { keyCode: 229 }],
])('an Escape that ends an IME composition (%s) does not dismiss', (_, init) => {
  render(<Popover onDismiss={onDismiss} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'inside' }), { key: 'Escape', ...init });
  expect(onDismiss).not.toHaveBeenCalled();
});

it('uses the latest callback and removes its listener on unmount', async () => {
  const user = userEvent.setup();
  const second = vi.fn();
  const { rerender, unmount } = render(<><p>elsewhere</p><Popover onDismiss={onDismiss} /></>);
  rerender(<><p>elsewhere</p><Popover onDismiss={second} /></>);
  await user.click(screen.getByText('elsewhere'));
  expect(onDismiss).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
  unmount();
  fireEvent.pointerDown(document.body);
  expect(second).toHaveBeenCalledTimes(1);
});
