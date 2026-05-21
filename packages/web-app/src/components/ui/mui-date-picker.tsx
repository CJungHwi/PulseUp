import React from 'react';
import { TextField } from '@mui/material';

interface MuiDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  className?: string;
}

export const MuiDatePicker: React.FC<MuiDatePickerProps> = ({
  value,
  onChange,
  label = "날짜 선택",
  className
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = event.target.value ? new Date(event.target.value) : null;
    onChange(dateValue);
  };

  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <TextField
      type="date"
      label={label}
      value={formatDateForInput(value)}
      onChange={handleChange}
      size="small"
      className={className}
      InputLabelProps={{
        shrink: true,
      }}
      sx={{
        minWidth: 160,
        '& .MuiOutlinedInput-root': {
          fontSize: '0.875rem',
        }
      }}
    />
  );
};

export default MuiDatePicker;


