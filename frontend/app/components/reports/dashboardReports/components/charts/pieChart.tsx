// components/PieChart.tsx
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
  } from 'chart.js';
  import { Pie } from 'react-chartjs-2';
  // @ts-ignore
  import ChartDataLabels from 'chartjs-plugin-datalabels';
  
  // Регистрируем модули
  ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);
  
  // Пример данных
  const data = {
    labels: ['Харажатга', 'Иш хакига', 'Таъминотчига'],
    datasets: [
      {
        label: 'Харажатлар таксими',
        data: [35, 45, 20],
        backgroundColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };
  
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 18,
          padding: 10,
          font: {
            size: 18
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || '';
            const value = context.raw || 0;
            return `${label}: ${value}%`;
          },
        },
      },
      datalabels: {
        color: '#fff',
        font: {
          weight: 'bold',
          size: 14
        },
        formatter: function(value: any, context: any) {
          const label = context.chart.data.labels[context.dataIndex];
          return `${label}\n${value}%`;
        },
        anchor: 'center',
        align: 'center',
        offset: 0
      }
    },
  };
  
  export default function PieChart() {
    return (
      <div style={{ height: '350px', width: '100%' }}>
        <Pie data={data} options={options} />
      </div>
    );
  }
  