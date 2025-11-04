import Chart from 'chart.js/auto';
import { resolveFriendlyDomain, toMinutes } from '../lib/analytics.js';

let chartInstance = null;

function toHeatColor(value, max) {
  const ratio = Math.max(0.15, Math.min(1, max === 0 ? 0 : value / max));
  const hue = 220 - ratio * 140;
  const saturation = 70 + ratio * 20;
  const lightness = 38 + (1 - ratio) * 18;
  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}% / 0.92)`;
}

export function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

export function renderChart(canvas, data, { filterLabel, timeframeLabel }) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext('2d');
  const labels = data.map((entry) => resolveFriendlyDomain(entry.domain));
  const totalMinutes = data.map((entry) => toMinutes(entry.totalSeconds));
  const activeMinutes = data.map((entry) => toMinutes(entry.activeSeconds));
  const idleMinutes = data.map((entry) => toMinutes(entry.idleSeconds));
  const maxMinutes = Math.max(...totalMinutes, 0.01);
  const gradientColors = totalMinutes.map((value) => toHeatColor(value, maxMinutes));

  destroyChart();

  const dynamicHeight = Math.max(220, data.length * 44);
  canvas.height = dynamicHeight;

  const datasets = [];

  if (filterLabel === 'Active') {
    datasets.push({
      data: activeMinutes,
      label: `${timeframeLabel} • Active`,
      backgroundColor: gradientColors,
      borderRadius: 14,
      borderSkipped: false,
      barPercentage: 0.9,
      categoryPercentage: 0.75,
    });
  } else if (filterLabel === 'Idle') {
    datasets.push({
      data: idleMinutes,
      label: `${timeframeLabel} • Idle`,
      backgroundColor: gradientColors,
      borderRadius: 14,
      borderSkipped: false,
      barPercentage: 0.9,
      categoryPercentage: 0.75,
    });
  } else {
    datasets.push(
      {
        data: activeMinutes,
        label: 'Active',
        backgroundColor: 'rgba(122, 127, 255, 0.85)',
        borderRadius: { topLeft: 14, bottomLeft: 14 },
        borderSkipped: false,
        stack: 'time',
        barPercentage: 0.9,
        categoryPercentage: 0.75,
      },
      {
        data: idleMinutes,
        label: 'Idle',
        backgroundColor: 'rgba(80, 227, 194, 0.85)',
        borderRadius: { topRight: 14, bottomRight: 14 },
        borderSkipped: false,
        stack: 'time',
        barPercentage: 0.9,
        categoryPercentage: 0.75,
      }
    );
  }

  chartInstance = new Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      animation: {
        duration: 520,
        easing: 'easeInOutQuad',
      },
      layout: {
        padding: {
          top: 8,
          bottom: 8,
          left: 4,
          right: 16,
        },
      },
      plugins: {
        legend: {
          display: filterLabel === 'All',
          labels: {
            color: 'rgba(223, 226, 255, 0.8)',
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          intersect: false,
          callbacks: {
            label(contextValue) {
              const value = Number(contextValue.raw ?? 0);
              return `${contextValue.dataset.label}: ${value.toFixed(1)} min`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: filterLabel === 'All',
          ticks: {
            color: 'rgba(223, 226, 255, 0.8)',
            callback(value) {
              const numeric = Number(value);
              return Number.isFinite(numeric) ? `${numeric.toFixed(0)}m` : value;
            },
          },
          grid: {
            color: 'rgba(122, 127, 255, 0.16)',
          },
          border: {
            color: 'rgba(122, 127, 255, 0.2)',
          },
        },
        y: {
          stacked: filterLabel === 'All',
          ticks: {
            color: 'rgba(223, 226, 255, 0.9)',
            font: {
              size: 12,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}
