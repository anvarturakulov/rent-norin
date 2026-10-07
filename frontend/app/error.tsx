'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Игнорируем ошибки Server Actions от ботов
  if (error.message?.includes('Failed to find Server Action')) {
    console.warn('Ignoring Server Action error from bot:', error.message);
    return null;
  }

  console.error('Application Error:', error);
  
  return (
    <div style={{ 
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      maxWidth: '800px',
      margin: '50px auto'
      
    }}>
      <h1 style={{ color: '#d32f2f' }}>Ошибка приложения</h1>
      <p style={{ color: '#666', margin: '20px 0', fontSize: '18px' }}>
        {error.message || 'Произошла неизвестная ошибка'}
      </p>
      
      <details style={{ 
        margin: '20px 0', 
        textAlign: 'left',
        background: '#f5f5f5',
        padding: '15px',
        borderRadius: '5px'
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
          Детали ошибки (для разработчика)
        </summary>
        <pre style={{ 
          background: '#fff', 
          padding: '10px', 
          overflow: 'auto',
          fontSize: '12px',
          marginTop: '10px',
          border: '1px solid #ddd'
        }}>
          {error.stack || JSON.stringify(error, null, 2)}
        </pre>
      </details>
      
      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={() => reset()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            marginRight: '10px'
          }}
        >
          Попробовать снова
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          style={{
            padding: '12px 24px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          На главную
        </button>
      </div>
    </div>
  );
}











