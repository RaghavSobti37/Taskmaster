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
  variant,
}) => (
  <NexusDropdown
    label={label}
    options={filterMode ? STATUS_FILTER_OPTIONS : STATUS_OPTIONS}
    value={value}
    onChange={onChange}
    disabled={disabled}
    placeholder={filterMode && placeholder === 'Status' ? 'All statuses' : placeholder}
    className={className}
    variant={variant}
  />
);

StatusSelect.displayName = 'StatusSelect';

export default StatusSelect;
