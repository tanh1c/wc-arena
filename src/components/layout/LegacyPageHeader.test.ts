import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEGACY_PAGE_HEADER_CLASS_NAME } from './LegacyPageHeader';

test('legacy page header frame matches AppShell header spacing and border', () => {
  const classes = LEGACY_PAGE_HEADER_CLASS_NAME.split(' ');

  for (const expectedClass of ['flex', 'items-center', 'justify-between', 'border-b-4', 'border-main', 'px-4', 'md:px-6', 'py-4', 'bg-card', 'z-30', 'sticky', 'top-0', 'shrink-0', 'gap-4']) {
    assert.ok(classes.includes(expectedClass), `missing ${expectedClass}`);
  }

  assert.equal(classes.includes('border-4'), false);
  assert.equal(classes.some((className) => className.startsWith('shadow-')), false);
});
