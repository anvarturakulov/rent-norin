import { InputInTableForNumbersProps } from './inputInTableForNumbers.props';
import { useInputTableForNumbersData } from './hooks/useInputTableData';
import TableInputForNumbers from './components/TableInputForNumbers';

export const InputInTableForNumbers = ({ 
  className, 
  nameControl, 
  itemIndexInTable, 
  disabled,
  ...props 
}: InputInTableForNumbersProps): JSX.Element => {
  // Используем кастомный хук для данных
  const { currentValue, handleChange, hasError, errorMessage } = useInputTableForNumbersData({
    nameControl,
    itemIndexInTable
  });

  return (
    <TableInputForNumbers
      className={className}
      nameControl={nameControl}
      itemIndexInTable={itemIndexInTable}
      currentValue={currentValue}
      onChange={handleChange}
      disabled={disabled}
      hasError={hasError}
      errorMessage={errorMessage}
      {...props}
    />
  );
};