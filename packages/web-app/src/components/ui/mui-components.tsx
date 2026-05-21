import React from 'react';
import { 
  Button, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Chip,
  Alert,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  DateRange as DateRangeIcon 
} from '@mui/icons-material';

// MUI Button 래퍼
export const MuiButton = Button;

// MUI TextField 래퍼
export const MuiTextField = TextField;

// MUI Select 래퍼
interface MuiSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const MuiSelect: React.FC<MuiSelectProps> = ({
  value,
  onChange,
  options,
  label = "선택",
  placeholder = "선택해주세요",
  className
}) => {
  return (
    <FormControl size="small" className={className} sx={{ minWidth: 160 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as string)}
        label={label}
        displayEmpty
      >
        <MenuItem value="">
          <em>{placeholder}</em>
        </MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

// MUI Card 래퍼
export const MuiCard = Card;
export const MuiCardContent = CardContent;

// MUI 아이콘들
export const MuiIcons = {
  Add: AddIcon,
  Edit: EditIcon,
  Delete: DeleteIcon,
  DateRange: DateRangeIcon,
};

// MUI 기타 컴포넌트들
export const MuiChip = Chip;
export const MuiAlert = Alert;
export const MuiTypography = Typography;
export const MuiIconButton = IconButton;
export const MuiTooltip = Tooltip;

export default {
  Button: MuiButton,
  TextField: MuiTextField,
  Select: MuiSelect,
  Card: MuiCard,
  CardContent: MuiCardContent,
  Chip: MuiChip,
  Alert: MuiAlert,
  Typography: MuiTypography,
  IconButton: MuiIconButton,
  Tooltip: MuiTooltip,
  Icons: MuiIcons,
};


