import React from 'react';
import NexusDropdown from '../ui/NexusDropdown';
import { STATUS_OPTIONS, STATUS_FILTER_OPTIONS } from '../../constants/taskOptions';

const StatusSelect = ({
  value,
  onChange,
  label = 'Status',
  disabled = false,
  filterMode = false,
  placeholder = 'Status',
  className = '',
}) => (
  <NexusDropdown
    label={label}
    options={filterMode ? STATUS_FILTER_OPTIONS : STATUS_OPTIONS}
    value={value}
    onChange={onChange}
    disabled={disabled}
    placeholder={placeholder}
    className={className}
  />
);

export default StatusSelect;
