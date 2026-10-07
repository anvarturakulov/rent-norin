import { MessageProps } from "./message.props";
import styles from './message.module.css';
import cn from 'classnames';
import { useAppContext } from '@/app/context/app.context';
import { EntryItem } from '@/app/interfaces/report.interface';
import { DocumentType } from '@/app/interfaces/document.interface';
import { secondsToDateString } from "../../documents/document/doc/helpers/doc.functions";
import { useEffect } from "react";
import { getDescriptionDocument } from '@/app/service/documents/getDescriptionDocument';
import { numberValue } from '@/app/service/common/converters';

export const Message = ({className, ...props}: MessageProps): JSX.Element => {
    const {mainData, setMainData} = useAppContext()

    const {messageType, message, showMessageWindow} = mainData.window
    const label = messageType == 'error' ? 'Хатолик' : messageType == 'success' ? 'Рахмат': '';

    useEffect(() => {
        if (showMessageWindow && messageType == 'success') {
            setTimeout(() => {
                setMainData && setMainData('showMessageWindow', false)
            }, 5000)
        }
    }, [showMessageWindow, messageType])

    return (
        <>
            {   typeof message == 'string' &&
                <div 
                    className={cn(styles.messageBox, className, {
                     [styles.error]: messageType == 'error',
                     [styles.success]: messageType == 'success',
                     [styles.warm]: messageType == 'warm',
                     [styles.showBox]: showMessageWindow,
                     })}
                     onClick={() => setMainData && setMainData('showMessageWindow', false)}
                     >
                    
                    <div>
                        {
                            typeof message == 'string' &&
                            <div className={styles.content}>{message}</div>
                        }
                    </div>
                </div>
            }

            {
                typeof message != 'string' &&
                <div 
                    className={cn(styles.messageBox, styles.success, styles.longBox, className, {
                     [styles.showBox]: showMessageWindow,
                     })}
                     onClick={() => setMainData && setMainData('showMessageWindow', false)}
                     >
                    <div>
                        {
                            message && message.length > 0 ? (
                                message.map((item: EntryItem, index: number) => {
                                    const documentDescription = getDescriptionDocument(String(item.documentType)) || String(item.documentType);
                                    const finalDescription = item.fullDescription || item.description;
                                    const descriptionText = finalDescription ? `, изох: ${finalDescription}` : '';
                                    const countText = item.count > 0 ? `, сон: ${numberValue(item.count)}` : '';
                                    
                                    // Формируем текст: Цех - Материал
                                    // Берем цех из дебета (первое субконто), материал из кредита (второе субконто)
                                    const workshop = item.debetFirstSubcontoName || '';
                                    const material = item.kreditSecondSubcontoName || '';
                                    
                                    let subcontoText = '';
                                    if (workshop && material) {
                                        subcontoText = `, ${workshop} - ${material}`;
                                    } else if (material) {
                                        subcontoText = `, ${material}`;
                                    } else if (workshop) {
                                        subcontoText = `, ${workshop}`;
                                    }
                                    
                                    return (
                                        <div className={styles.item} key={index}>
                                            {`${index+1}. сана: ${secondsToDateString(item.date)}${countText}, сумма: ${numberValue(item.total)} (${documentDescription})${subcontoText}${descriptionText}`}
                                        </div>
                                    )
                                })
                            ) : (
                                <div className={styles.item}>Маълумот топилмади</div>
                            )
                        }
                    </div>
                </div>
            }
        </>
    )
}