// components/BarChart.tsx
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
  } from 'chart.js';
  import { Bar } from 'react-chartjs-2';
  
  // Регистрируем компоненты
  ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
  
  // Пример данных
  const data = {
    labels: ['Анвар', 'Акмал', 'Чарос', 'Ирода', 'Дилшод', 'Абдулло'],
    datasets: [
      {
        label: 'Савдо хажми',
        data: [400, 300, 500, 600, 700, 800],
        backgroundColor: '#2563EB',
      },
      
    ],
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          padding: 8,
          font: {
            size: 14
          }
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 14
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: 14
          }
        }
      }
    }
  };
  
  export default function BarChart() {
    return (
      <div style={{ height: '350px', width: '100%' }}>
        <Bar data={data} options={options} />
      </div>
    );
  }
  