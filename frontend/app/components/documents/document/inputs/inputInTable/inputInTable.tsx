import { InputInTableProps } from './inputInTable.props';
import { useInputTableData } from './hooks/useInputTableData';
import TableInput from './components/TableInput';

export const InputInTable = ({ 
  className, 
  nameControl, 
  itemIndexInTable, 
  ...props 
}: InputInTableProps): JSX.Element => {
  // Используем кастомный хук для данных
  const { currentValue, handleChange } = useInputTableData({
    nameControl,
    itemIndexInTable
  });

  return (
    <TableInput
      className={className}
      nameControl={nameControl}
      itemIndexInTable={itemIndexInTable}
      currentValue={currentValue}
      onChange={handleChange}
      {...props}
    />
  );
};