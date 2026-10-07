import { checkBoxInFormProps } from './checkBoxInForm.props';
import { useCheckboxData } from './hooks/useCheckboxData';
import CheckboxInput from './components/CheckboxInput';

export const CheckBoxInForm = ({ 
  className, 
  id, 
  label, 
  ...props 
}: checkBoxInFormProps): JSX.Element => {
  // Используем кастомный хук для данных
  const { currentValue, handleChange } = useCheckboxData({ id });

  return (
    <CheckboxInput
      className={className}
      id={id}
      label={label}
      checked={currentValue}
      onChange={handleChange}
      {...props}
    />
  );
};
