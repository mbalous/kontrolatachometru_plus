import { initStationLookup } from './stationLookup';

type MileagePoint = { date: Date; km: number; dateText: string };
type MileageAnomaly = { index: number; from: MileagePoint; to: MileagePoint; diff: number };

(function main() {
	'use strict';

	function parseMileageData(): MileagePoint[] {
		const table = document.getElementById('inspectionTable');
		if (!table) return [];

		const rows = table.querySelectorAll('tbody tr');
		const dayMap = new Map<string, MileagePoint>();

		rows.forEach((row) => {
			const dateCell = row.querySelector<HTMLTableCellElement>('td[data-finish-date]');
			const kmCell = row.querySelector<HTMLTableCellElement>('td[data-km-staff]');

			if (!dateCell || !kmCell) return;

			const dateText = (dateCell.textContent ?? '').trim();
			const kmSpan = kmCell.querySelector<HTMLSpanElement>('span');
			if (!kmSpan) return;

			// Parse km value: remove spaces (including NBSP), convert to number
			const kmText = (kmSpan.textContent ?? '').replace(/\s/g, '').replace(/\u00A0/g, '');
			const km = Number.parseInt(kmText, 10);

			const [d, m, y] = dateText.split('.').map((p) => Number.parseInt(p, 10));
			if (!d || !m || !y) return;
			const date = new Date(y, m - 1, d);

			if (Number.isNaN(km) || Number.isNaN(date.getTime())) return;

			// Keep only the highest mileage entry for each day
			const dayKey = dateText;
			const existing = dayMap.get(dayKey);
			if (!existing || km > existing.km) {
				dayMap.set(dayKey, { date, km, dateText });
			}
		});

		const data = Array.from(dayMap.values());
		data.sort((a, b) => a.date.getTime() - b.date.getTime());
		return data;
	}

	function detectAnomalies(data: MileagePoint[]): MileageAnomaly[] {
		return data.slice(1).reduce<MileageAnomaly[]>((acc, cur, i) => {
			const prev = data[i]!;
			if (cur.km < prev.km) acc.push({ index: i + 1, from: prev, to: cur, diff: prev.km - cur.km });
			return acc;
		}, []);
	}

	function formatNumber(num: number): string {
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	}

	function createChart(data: MileagePoint[]): void {
		if (data.length === 0) return;

		const tableWrapper = document.querySelector<HTMLElement>('#inspectionTable_wrapper');
		if (!tableWrapper) return;

		// Check if chart already exists
		if (document.getElementById('mileage-chart-container')) return;

		const container = document.createElement('div');
		container.id = 'mileage-chart-container';

		const title = document.createElement('h3');
		title.textContent = '📈 Graf stavu tachometru';
		container.appendChild(title);

		const canvas = document.createElement('canvas');
		canvas.id = 'mileage-chart';
		container.appendChild(canvas);

		const kmValues = data.map((d) => d.km);
		const minKm = Math.min(...kmValues);
		const maxKm = Math.max(...kmValues);
		const totalDistance = maxKm - minKm;
		const firstDate = data[0]?.date;
		const lastDate = data[data.length - 1]?.date;
		if (!firstDate || !lastDate) return;

		const daysDiff = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)));
		const avgPerDay = Math.round(totalDistance / daysDiff);
		const avgPerYear = Math.round(avgPerDay * 365);

		const stats = document.createElement('div');
		stats.className = 'mileage-stats';
		const statItems: [string, string][] = [
			[`${formatNumber(minKm)} km`, 'První záznam'],
			[`${formatNumber(maxKm)} km`, 'Poslední záznam'],
			[`${formatNumber(totalDistance)} km`, 'Celkový nárůst'],
			[`~${formatNumber(avgPerYear)} km/rok`, 'Průměrný nájezd']
		];
		stats.innerHTML = statItems.map(([v, l]) => `<div class="stat-item"><div class="stat-value">${v}</div><div class="stat-label">${l}</div></div>`).join('');
		container.appendChild(stats);

		const anomalies = detectAnomalies(data);
		if (anomalies.length > 0) {
			const warning = document.createElement('div');
			warning.className = 'anomaly-warning';
			const fmt = (a: MileageAnomaly) => `Mezi ${a.from.dateText} (${formatNumber(a.from.km)} km) a ${a.to.dateText} (${formatNumber(a.to.km)} km) - pokles o ${formatNumber(a.diff)} km`;
			warning.innerHTML = `<strong>⚠️ Pozor:</strong> Zjištěn pokles stavu tachometru! ${anomalies.map(fmt).join('; ')}`;
			container.appendChild(warning);
		}

		// Insert after the table
		const boxBody = tableWrapper.closest<HTMLElement>('.box-body');
		if (boxBody?.parentNode) {
			boxBody.parentNode.insertBefore(container, boxBody.nextSibling);
		} else if (tableWrapper.parentNode) {
			tableWrapper.parentNode.insertBefore(container, tableWrapper.nextSibling);
		}

		drawChart(canvas, data, anomalies);
	}

	function drawChart(canvas: HTMLCanvasElement, data: MileagePoint[], anomalies: MileageAnomaly[]): void {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const [cssWidth, cssHeight, dpr] = [canvas.offsetWidth || 800, canvas.offsetHeight || 350, Math.max(1, window.devicePixelRatio || 1)];
		[canvas.width, canvas.height] = [Math.round(cssWidth * dpr), Math.round(cssHeight * dpr)];
		[canvas.style.width, canvas.style.height] = [`${cssWidth}px`, `${cssHeight}px`];
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		const padding = { top: 30, right: 30, bottom: 60, left: 80 };
		const chartWidth = cssWidth - padding.left - padding.right;
		const chartHeight = cssHeight - padding.top - padding.bottom;

		const kmValues = data.map((d) => d.km);
		const minKm = Math.min(...kmValues);
		const maxKm = Math.max(...kmValues);
		const kmRange = maxKm - minKm || 1;
		const kmPadding = kmRange * 0.1;

		const firstDate = data[0]?.date;
		const lastDate = data[data.length - 1]?.date;
		if (!firstDate || !lastDate) return;

		const minDate = firstDate.getTime();
		const maxDate = lastDate.getTime();
		const dateRange = maxDate - minDate || 1;

		const xScale = (date: Date): number => {
			return padding.left + ((date.getTime() - minDate) / dateRange) * chartWidth;
		};

		const yScale = (km: number): number => padding.top + chartHeight - ((km - (minKm - kmPadding)) / (kmRange + 2 * kmPadding)) * chartHeight;

		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, cssWidth, cssHeight);

		ctx.strokeStyle = '#eee';
		ctx.lineWidth = 1;
		const yTicks = 5;
		for (let i = 0; i <= yTicks; i++) {
			const y = padding.top + (chartHeight / yTicks) * i;
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(cssWidth - padding.right, y);
			ctx.stroke();

			const kmValue = maxKm + kmPadding - ((kmRange + 2 * kmPadding) / yTicks) * i;
			ctx.fillStyle = '#666';
			ctx.font = '11px Arial';
			ctx.textAlign = 'right';
			ctx.fillText(`${formatNumber(Math.round(kmValue))} km`, padding.left - 10, y + 4);
		}

		ctx.strokeStyle = '#3c8dbc';
		ctx.lineWidth = 2;
		ctx.beginPath();
		data.forEach((point, i) => {
			const x = xScale(point.date);
			const y = yScale(point.km);
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		});
		ctx.stroke();

		ctx.fillStyle = 'rgba(60, 141, 188, 0.1)';
		ctx.beginPath();
		ctx.moveTo(xScale(firstDate), cssHeight - padding.bottom);
		data.forEach((point) => {
			ctx.lineTo(xScale(point.date), yScale(point.km));
		});
		ctx.lineTo(xScale(lastDate), cssHeight - padding.bottom);
		ctx.closePath();
		ctx.fill();

		const anomalyIndices = new Set<number>(anomalies.flatMap((a) => [a.index - 1, a.index]));
		data.forEach((point, i) => {
			const x = xScale(point.date);
			const y = yScale(point.km);

			ctx.beginPath();
			ctx.arc(x, y, 5, 0, Math.PI * 2);
			ctx.fillStyle = anomalyIndices.has(i) ? '#dc3545' : '#3c8dbc';
			ctx.fill();
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.stroke();
		});

		ctx.fillStyle = '#666';
		ctx.font = '11px Arial';
		ctx.textAlign = 'center';
		const labelInterval = Math.max(1, Math.floor(data.length / 6));
		data.forEach((point, i) => {
			if (i % labelInterval !== 0 && i !== data.length - 1) return;
			const x = xScale(point.date);
			ctx.save();
			ctx.translate(x, cssHeight - padding.bottom + 15);
			ctx.rotate(-Math.PI / 6);
			ctx.fillText(point.dateText, 0, 0);
			ctx.restore();
		});

		addTooltip(canvas, data, xScale, yScale);
	}

	function addTooltip(
		canvas: HTMLCanvasElement,
		data: MileagePoint[],
		xScale: (date: Date) => number,
		yScale: (km: number) => number
	): void {
		if (document.querySelector('.chart-tooltip')) return;

		const tooltip = document.createElement('div');
		tooltip.className = 'chart-tooltip';
		tooltip.style.display = 'none';
		document.body.appendChild(tooltip);

		canvas.addEventListener('mousemove', (e) => {
			const rect = canvas.getBoundingClientRect();
			const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];
			const closest = data.reduce<{ point: MileagePoint | null; dist: number }>(
				(acc, p) => {
					const dist = Math.hypot(x - xScale(p.date), y - yScale(p.km));
					return dist < acc.dist && dist < 30 ? { point: p, dist } : acc;
				},
				{ point: null, dist: Number.POSITIVE_INFINITY }
			).point;

			if (closest) {
				tooltip.innerHTML = `<strong>${closest.dateText}</strong><br>${formatNumber(closest.km)} km`;
				[tooltip.style.display, tooltip.style.left, tooltip.style.top] = ['block', `${e.pageX + 15}px`, `${e.pageY - 10}px`];
			} else tooltip.style.display = 'none';
		});

		canvas.addEventListener('mouseleave', () => {
			tooltip.style.display = 'none';
		});
	}

	const init = () => {
		const data = parseMileageData();
		if (data.length > 0) createChart(data);
		initStationLookup();
	};

	document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init, { once: true }) : init();

	new MutationObserver(() => {
		if (document.getElementById('inspectionTable') && !document.getElementById('mileage-chart-container')) init();
	}).observe(document.body, { childList: true, subtree: true });
})();
