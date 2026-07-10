import React, { isValidElement } from 'react';
import SearchInput from './SearchInput';

/** Recognize toolbar search fields (direct type, marker, or displayName). */
export function isSearchInputElement(child) {
  if (!isValidElement(child)) return false;
  if (child.type === SearchInput) return true;
  if (child.props?.['data-mobile-search']) return true;
  const name = child.type?.displayName || child.type?.name;
  return name === 'SearchInput';
}

export function isMobileInlineElement(child) {
  if (!isValidElement(child)) return false;
  return Boolean(child.props?.['data-mobile-inline']);
}

/**
 * Flatten fragments and layout-only div wrappers so SearchInput is discoverable on mobile.
 * ponytail: only unwrap plain divs — keeps intentional single filter blobs intact when marked.
 */
export function flattenToolbarChildren(children) {
  const result = [];

  React.Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      if (child != null && child !== false) result.push(child);
      return;
    }

    if (child.type === React.Fragment) {
      result.push(...flattenToolbarChildren(child.props.children));
      return;
    }

    if (
      child.type === 'div'
      && !child.props?.['data-toolbar-field']
      && !child.props?.['data-mobile-filter-group']
    ) {
      result.push(...flattenToolbarChildren(child.props.children));
      return;
    }

    result.push(child);
  });

  return result;
}

/** Split toolbar children into mobile inline search, inline controls, and sheet filters. */
export function partitionToolbarChildren(childArray, mobileSearch) {
  if (mobileSearch !== undefined) {
    return {
      inlineSearch: mobileSearch,
      inlineControls: childArray.filter(isMobileInlineElement),
      filterChildren: childArray.filter((c) => !isMobileInlineElement(c)),
    };
  }

  const searchIdx = childArray.findIndex(isSearchInputElement);
  const inlineControls = childArray.filter(isMobileInlineElement);
  const filterChildren = childArray.filter(
    (c, i) => i !== searchIdx && !isMobileInlineElement(c),
  );

  return {
    inlineSearch: searchIdx >= 0 ? childArray[searchIdx] : null,
    inlineControls,
    filterChildren,
  };
}

/** Search + lone CTA share one row on mobile (Equipment, Contacts); not Todo/Leads with filter sheet. */
export function shouldInlineMobileSearchWithAction({
  inlineSearch,
  hasFilters,
  inlineControlCount,
  actionCount,
}) {
  return Boolean(
    inlineSearch
    && actionCount === 1
    && !hasFilters
    && inlineControlCount === 0,
  );
}

/** Primary / overflow CTAs sit on the search row when search is present. */
export function shouldShowActionsInMobileSearchRow({
  inlineSearch,
  inlineSearchWithAction,
  actionCount,
}) {
  return Boolean(
    inlineSearch
    && (inlineSearchWithAction || actionCount > 0),
  );
}
