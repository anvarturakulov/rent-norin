import React, { useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import styles from './Counter.module.css';

interface CounterProps {
  value: number;
  duration?: number; // длительность анимации в секундах
  delay?: number; // задержка перед началом анимации
  className?: string;
  prefix?: string; // префикс (например, "$")
  suffix?: string; // суффикс (например, "%")
  decimals?: number; // количество десятичных знаков
  useGSAP?: boolean; // использовать ли GSAP
}

export const Counter: React.FC<CounterProps> = ({
  value,
  duration = 2,
  delay = 0,
  className,
  prefix = '',
  suffix = '',
  decimals = 0,
  useGSAP = false
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const counterRef = useRef<HTMLSpanElement>(null);

  // Функция для форматирования числа
  const formatNumber = (num: number): string => {
    const formatted = num.toFixed(decimals);
    return `${prefix}${formatted}${suffix}`;
  };

  // Анимация без GSAP (CSS transitions + JavaScript)
  const animateWithoutGSAP = () => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    const startValue = 0;
    const endValue = value;
    const startTime = Date.now();
    const animationDuration = duration * 1000;

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
      }
    };

    setTimeout(() => {
      requestAnimationFrame(animate);
    }, delay * 1000);
  };

  // Анимация с GSAP
  const animateWithGSAP = async () => {
    if (isAnimating || !counterRef.current) return;

    try {
      // Динамический импорт GSAP
      const { gsap } = await import('gsap');
      
      setIsAnimating(true);
      
      gsap.fromTo(
        counterRef.current,
        { innerText: 0 },
        {
          innerText: value,
          duration: duration,
          delay: delay,
          ease: "power2.out",
          snap: { innerText: 1 },
          onUpdate: function() {
            const currentValue = Math.round(parseFloat(this.targets()[0].innerText) || 0);
            setDisplayValue(currentValue);
          },
          onComplete: () => {
            setDisplayValue(value);
            setIsAnimating(false);
          }
        }
      );
    } catch (error) {
      console.error('GSAP not available, falling back to CSS animation');
      animateWithoutGSAP();
    }
  };

  useEffect(() => {
    if (useGSAP) {
      animateWithGSAP();
    } else {
      animateWithoutGSAP();
    }
  }, [value, duration, delay, useGSAP]);

  return (
    <span 
      ref={counterRef}
      className={cn(styles.counter, className)}
    >
      {formatNumber(displayValue)}
    </span>
  );
};

export default Counter; 