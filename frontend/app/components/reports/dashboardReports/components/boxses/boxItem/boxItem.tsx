'use client'
import { BoxItemProps } from './boxItem.props';
import styles from './boxItem.module.css';
import { numberValue } from '@/app/service/common/converters';
import cn from 'classnames';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export const BoxItem = ({className, item, ...props }: BoxItemProps) :JSX.Element => {
    const valueRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (!valueRef.current || item?.value === undefined) {
            return;
        }

        const targetValue = item.value;
        const obj = { value: 0 };

        const tween = gsap.to(obj, {
            value: targetValue,
            duration: 1.5,
            ease: 'power2.out',
            onUpdate: () => {
                if (valueRef.current) {
                    valueRef.current.textContent = numberValue(Math.floor(obj.value));
                }
            },
        });

        return () => {
            tween.kill();
        };
    }, [item?.value]);
    
    return (
      <div className={styles.boxItem}>
        <div className={styles.titleBox}> 
          <div className={styles.title}>{item?.title}</div>
          <div
            className={styles.icon}
            style={item?.icon ? { backgroundImage: `url(${item.icon})` } : undefined}
            role="img"
            aria-label={item?.title ?? ''}
          />
        </div>
        <div className={styles.value} ref={valueRef}>0</div>
        <div className={styles.comment}>
          <div className={cn(styles.percent, {
            [styles.negative]: item?.percent < 0,
            [styles.positive]: item?.percent > 0,
          })}>
            {item?.percent>=0 ? '+ ' : '- '}
            {Math.abs(item?.percent)}%
          </div>
          <div className={styles.commentText}>
            утган ойга нисбатан
          </div>
        </div>
      </div>
    )
} 