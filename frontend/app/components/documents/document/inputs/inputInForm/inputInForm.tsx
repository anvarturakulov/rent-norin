import { InputInFormProps } from './inputInForm.props';
import { useInputFormData } from './hooks/useInputFormData';
import FormInput from './components/FormInput';

export const InputInForm = ({ 
  visible, 
  label, 
  className, 
  nameControl, 
  isNewDocument,
  labelPosition,
  ...props 
}: InputInFormProps): JSX.Element => {
  // Используем кастомный хук для данных
  const { currentValue, handleChange } = useInputFormData({ nameControl });

  return (
    <FormInput
      className={className}
      label={label}
      nameControl={nameControl}
      currentValue={currentValue}
      onChange={handleChange}
      visible={visible}
      labelPosition={labelPosition}
      {...props}
    />
  );
};
