import React from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { PRIORITY_OPTIONS, PRIORITY_FILTER_OPTIONS } from '../../constants/taskOptions';

const PrioritySelect = ({
  value,
  onChange,
  label = 'Priority',
  disabled = false,
  filterMode = false,
  placeholder = 'Priority',
  className = '',
  variant,
}) => (
  <NexusDropdown
    label={label}
    options={filterMode ? PRIORITY_FILTER_OPTIONS : PRIORITY_OPTIONS}
    value={value}
    onChange={onChange}
    disabled={disabled}
    placeholder={filterMode && placeholder === 'Priority' ? 'All priorities' : placeholder}
    className={className}
    variant={variant}
  />
);

PrioritySelect.displayName = 'PrioritySelect';

export default PrioritySelect;
