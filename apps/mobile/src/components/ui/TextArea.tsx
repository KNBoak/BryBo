import React from 'react';
import { Input } from './Input';

interface TextAreaProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  numberOfLines?: number;
  editable?: boolean;
}

export function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  numberOfLines = 4,
  editable,
}: TextAreaProps) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      error={error}
      multiline
      numberOfLines={numberOfLines}
      editable={editable}
    />
  );
}
