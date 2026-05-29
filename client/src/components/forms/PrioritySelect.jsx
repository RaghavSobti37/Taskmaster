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
}) => (
  <NexusDropdown
    label={label}
    options={filterMode ? PRIORITY_FILTER_OPTIONS : PRIORITY_OPTIONS}
    value={value}
    onChange={onChange}
    disabled={disabled}
    placeholder={placeholder}
    className={className}
  />
);

export default PrioritySelect;
