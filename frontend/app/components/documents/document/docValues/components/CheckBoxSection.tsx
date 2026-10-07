import React, { memo } from 'react';
import { CheckBoxInForm } from '../../inputs/checkBoxInForm/checkBoxInForm';
import { DOC_VALUES_LABELS } from '../constants/docValues.constants';
import styles from '../docValues.module.css';

interface CheckBoxSectionProps {
  checkboxStates: {
    hasWorkers: boolean;
    hasMediators: boolean;
    hasDeliverers: boolean;
    hasPartners: boolean;
    hasClients: boolean;
    hasFounders: boolean;
    hasDepartments: boolean;
  };
}

const CheckBoxSection = memo<CheckBoxSectionProps>(({ checkboxStates }) => {
  return (
    <div className={styles.checkBoxs}>
      {checkboxStates.hasWorkers && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.WORKER} id={'worker'} />
      )}

      {checkboxStates.hasMediators && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.MEDIATOR} id={'mediator'} />
      )}

      {checkboxStates.hasDeliverers && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.DELIVERER} id={'deliverer'} />
      )}

      {checkboxStates.hasPartners && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.PARTNER} id={'partner'} />
      )}

      {checkboxStates.hasClients && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.CLIENT} id={'client'} />
      )}

      {checkboxStates.hasFounders && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.FOUNDER} id={'founder'} />
      )}

      {checkboxStates.hasDepartments && (
        <CheckBoxInForm label={DOC_VALUES_LABELS.DEPARTMENT} id={'department'} />
      )}
    </div>
  );
});

CheckBoxSection.displayName = 'CheckBoxSection';

export default CheckBoxSection;
