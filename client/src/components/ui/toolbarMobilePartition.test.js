import React from 'react';
import { describe, it, expect } from 'vitest';
import SearchInput from './SearchInput';
import NexusDropdown from './NexusDropdown';
import {
  flattenToolbarChildren,
  partitionToolbarChildren,
  isSearchInputElement,
  shouldInlineMobileSearchWithAction,
  shouldShowActionsInMobileSearchRow,
} from './toolbarMobilePartition';

describe('toolbarMobilePartition', () => {
  it('detects SearchInput by component reference and displayName', () => {
    const search = React.createElement(SearchInput, { value: '', onChange: () => {} });
    expect(isSearchInputElement(search)).toBe(true);
  });

  it('flattens wrapper divs so search is not trapped in the filter sheet', () => {
    const wrapped = React.createElement(
      'div',
      { className: 'flex flex-wrap gap-2' },
      React.createElement('select', { 'aria-label': 'Sheet' },
        React.createElement('option', null, 'All')),
      React.createElement(SearchInput, { value: 'x', onChange: () => {}, placeholder: 'Search contacts' }),
      React.createElement(NexusDropdown, { value: '', onChange: () => {}, options: [], placeholder: 'Outlet' }),
    );

    const flat = flattenToolbarChildren(wrapped);
    expect(flat).toHaveLength(3);
    expect(isSearchInputElement(flat[1])).toBe(true);
  });

  it('keeps grouped filters when data-mobile-filter-group is set', () => {
    const grouped = React.createElement(
      'div',
      { 'data-mobile-filter-group': true },
      React.createElement(NexusDropdown, { value: '', onChange: () => {}, options: [], placeholder: 'A' }),
      React.createElement(NexusDropdown, { value: '', onChange: () => {}, options: [], placeholder: 'B' }),
    );

    const flat = flattenToolbarChildren(grouped);
    expect(flat).toHaveLength(1);
    expect(flat[0].props['data-mobile-filter-group']).toBe(true);
  });

  it('partitions search into inline row and leaves other controls for the sheet', () => {
    const flat = flattenToolbarChildren([
      React.createElement(SearchInput, { value: '', onChange: () => {} }),
      React.createElement(NexusDropdown, { value: '', onChange: () => {}, options: [], placeholder: 'Status' }),
    ]);

    const { inlineSearch, filterChildren } = partitionToolbarChildren(flat);
    expect(isSearchInputElement(inlineSearch)).toBe(true);
    expect(filterChildren).toHaveLength(1);
    expect(isSearchInputElement(filterChildren[0])).toBe(false);
  });

  it('inlines search with lone CTA only when no sheet filters or inline controls', () => {
    const search = React.createElement(SearchInput, { value: '', onChange: () => {} });
    expect(
      shouldInlineMobileSearchWithAction({
        inlineSearch: search,
        hasFilters: false,
        inlineControlCount: 0,
        actionCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldInlineMobileSearchWithAction({
        inlineSearch: search,
        hasFilters: true,
        inlineControlCount: 0,
        actionCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldInlineMobileSearchWithAction({
        inlineSearch: search,
        hasFilters: false,
        inlineControlCount: 1,
        actionCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldInlineMobileSearchWithAction({
        inlineSearch: search,
        hasFilters: false,
        inlineControlCount: 0,
        actionCount: 2,
      }),
    ).toBe(false);
  });

  it('places actions on search row when search is present', () => {
    const search = React.createElement(SearchInput, { value: '', onChange: () => {} });
    expect(
      shouldShowActionsInMobileSearchRow({
        inlineSearch: search,
        inlineSearchWithAction: true,
        actionCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldShowActionsInMobileSearchRow({
        inlineSearch: search,
        inlineSearchWithAction: false,
        actionCount: 2,
      }),
    ).toBe(true);
    expect(
      shouldShowActionsInMobileSearchRow({
        inlineSearch: search,
        inlineSearchWithAction: false,
        actionCount: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowActionsInMobileSearchRow({
        inlineSearch: null,
        inlineSearchWithAction: false,
        actionCount: 1,
      }),
    ).toBe(false);
  });
});
