'use client'
import { useEffect, useState } from 'react'
import styles from './Auth.module.css'
import { redirect } from 'next/navigation'
import { useAppContext } from '@/app/context/app.context'
import { Htag } from '../common/htag/Htag'
import { Input } from '../common/input/input'
import { Message } from '../common/message/message'
import { setTodayToInterval } from '@/app/service/reports/setTodayToInterval'
import { BodyForLogin, dashboardUsersList, workersUsersList } from '@/app/interfaces/user.interface'
import Script from 'next/script'
import { detectPlatform } from '@/app/service/common/platform/platformDetector'
import { onSubmit, onVerifyOtp } from './helpers'
import { disableTelegramLogs } from '@/app/utils/telegramLogger'

const defaultBody: BodyForLogin = {
  email: '',
  password: ''
}

export default function Auth() {
  
  const {mainData, setMainData} = useAppContext();
  const { user } = mainData.users
  const [body, setBody] = useState<BodyForLogin>(defaultBody)
  const [otpCode, setOtpCode] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [platform, setPlatform] = useState<string>('none');
  const [isLikelyTelegramClient, setIsLikelyTelegramClient] = useState(false);
  const [telegramAutoLoginTried, setTelegramAutoLoginTried] = useState(false);

  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  
  const changeElements = (e: React.FormEvent<HTMLInputElement>) => {
      let target = e.currentTarget
      setBody(state => {
          return {
              ...state,
              [target.id]: target.value
          }
      })
  }

  useEffect(() => {
    setTodayToInterval(setMainData);
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || '';
    const params = new URLSearchParams(window.location.search);
    const isTelegramUa = ua.includes('Telegram') || ua.includes('TelegramWebApp');
    const hasTelegramParams = params.has('tgWebAppData') || params.has('tgWebAppStartParam');
    setIsLikelyTelegramClient(isTelegramUa || hasTelegramParams);
  }, []);

  useEffect(() => {
    setTodayToInterval(setMainData);
  
    if (!isSdkLoaded) {
      setPlatform('none');
      return;
    }
    const win: any = window;
    const tg = win.Telegram?.WebApp;
  
    if (tg?.initData && tg.initData.length > 0) {
      setPlatform('telegram'); // ✅ точно Mini App
    } else {
      setPlatform('browser');  // ❌ обычный браузер
    }
  }, [isSdkLoaded]);

  useEffect(() => {
    if (!isSdkLoaded || platform !== 'telegram' || telegramAutoLoginTried) return;
    if (user) return;
    setTelegramAutoLoginTried(true);
    onSubmit(defaultBody, setMainData, 'telegram');
  }, [isSdkLoaded, platform, telegramAutoLoginTried, user, setMainData]);

  useEffect(() => {
    const {user} = mainData.users
    
    // Перенаправляем только если пользователь авторизован (не undefined)
    if (user !== undefined && user !== null) {
      if (workersUsersList.includes(user?.role)) {
        if (platform == 'telegram') {
          redirect('/workers')
          return;
        }
        alert('Рабочие роли должны входить только через Telegram Mini App');
        setMainData && setMainData('user', undefined);
        return;
      }
      if (dashboardUsersList.includes(user?.role)) {
        redirect('/dashboard')
      } else {
        alert('Dasturga bu yerdan kirmang')
      }
    }
    // Если user === undefined, значит пользователь вышел из системы - показываем форму входа

  }, [user, platform, setMainData])

  useEffect(()=> {
    if (isSdkLoaded && setMainData) {
          const platformInfo = detectPlatform();
          setMainData('platform.info', platformInfo);
    }
  }, [isSdkLoaded, setMainData])

  useEffect(() => {
    // Отключаем логи Telegram Web App
    const restoreLogs = disableTelegramLogs();
    
    // Восстанавливаем оригинальные функции при размонтировании
    return restoreLogs;
  }, []);

  const handlePasswordLogin = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await onSubmit(body, setMainData, 'browser');
      if (result === 'otp') {
        setOtpStep(true);
        setOtpCode('');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleVerifyOtp = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onVerifyOtp(body.email, otpCode, setMainData);
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleResendOtp = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await onSubmit(body, setMainData, 'browser');
      if (result === 'otp') {
        setOtpCode('');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleBackToPassword = () => {
    setOtpStep(false);
    setOtpCode('');
  }

  const shouldShowTelegramOnlyLogin = isLikelyTelegramClient || platform === 'telegram';

  return (
    <>
        <div className={styles.container}>
            <div className={styles.content}>
              <Htag tag='h1'>{`KORD ERP`}</Htag>
              <Htag tag='h3'>{`Ишлаб чикариш ва курилишни автоматизация килувчи веб-дастур`}</Htag>
              {!shouldShowTelegramOnlyLogin && (
                <div
                  className={styles.authBlock}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (otpStep) {
                      void handleVerifyOtp();
                    } else {
                      void handlePasswordLogin();
                    }
                  }}
                >
                  {!otpStep && (
                    <>
                      <Input value={body.email} placeholder='Email' label='' id='email' onChange={(e)=>changeElements(e)}/>
                      <Input value={body.password} placeholder='Password' type='password' label='' id='password' onChange={(e)=>changeElements(e)}/>
                      <button 
                        className={styles.button}
                        disabled={isSubmitting}
                        onClick={handlePasswordLogin}>
                          {isSubmitting ? 'Кутинг...' : 'Кириш'}
                      </button>
                    </>
                  )}
                  {otpStep && (
                    <>
                      <p className={styles.otpHint}>
                        Код {body.email} фойдаланувчисининг Telegramига юборилди
                      </p>
                      <Input
                        value={otpCode}
                        placeholder='Telegram коди'
                        label=''
                        id='otp'
                        inputMode='numeric'
                        autoComplete='one-time-code'
                        maxLength={6}
                        onChange={(e)=>setOtpCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                      />
                      <button 
                        className={styles.button}
                        disabled={isSubmitting}
                        onClick={handleVerifyOtp}>
                          {isSubmitting ? 'Кутинг...' : 'Тасдиқлаш'}
                      </button>
                      <button
                        className={styles.secondaryButton}
                        disabled={isSubmitting}
                        onClick={handleResendOtp}
                        type='button'>
                          Кодни қайта юбориш
                      </button>
                      <button
                        className={styles.linkButton}
                        disabled={isSubmitting}
                        onClick={handleBackToPassword}
                        type='button'>
                          Орқага
                      </button>
                    </>
                  )}
                </div>
              )}

              {shouldShowTelegramOnlyLogin && (
                <div className={styles.telegramAuthBlock}>
                  <button 
                    className={styles.button} 
                    disabled={!isSdkLoaded}
                    onClick={() => onSubmit(body, setMainData, 'telegram')}>
                      {isSdkLoaded ? 'Кириш (Telegram)' : 'Telegram юкланмоқда...'}
                  </button>
                </div>
              )}
            </div>
            
        </div>
        <Message/>
        {true && 
          <>
            <Script
              src="https://telegram.org/js/telegram-web-app.js"
              strategy="afterInteractive"
              onLoad={() => {
                setIsSdkLoaded(true);
              }}
              onError={(e) => {
                console.error('Failed to load Telegram WebApp SDK:', e);
                setIsSdkLoaded(false);
              }}
            />
          </>
        }
    </>
  )
}
