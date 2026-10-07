import { DocValuesProps } from './docValues.props';
import { useAppContext } from '@/app/context/app.context';
import { useDocValuesData } from './hooks/useDocValuesData';
import InfoSection from './components/InfoSection';
import CheckBoxSection from './components/CheckBoxSection';
import PartnersSection from './components/PartnersSection';
import ValuesSection from './components/ValuesSection';

export const DocValues = (_props: DocValuesProps): JSX.Element => {
  const { mainData, setMainData } = useAppContext();
  const { contentTitle } = mainData.document;
  const { currentDocument } = mainData.document;

  // Используем кастомный хук для данных
  const {
    options,
    checkboxStates,
    definedIds,
    currentValues,
    contentName
  } = useDocValuesData();

  return (
    <>
      <InfoSection 
        contentTitle={contentTitle}
        documentId={currentDocument?.id}
      />

      <CheckBoxSection checkboxStates={checkboxStates} />

      <PartnersSection 
        options={options}
        currentValues={currentValues}
        definedIds={definedIds}
      />

      <ValuesSection 
        options={options}
        currentDocument={currentDocument}
        currentValues={currentValues}
        checkboxStates={checkboxStates}
        contentName={contentName}
        setMainData={setMainData}
        mainData={mainData}
        definedIds={definedIds}
      />
    </>
  );
};


