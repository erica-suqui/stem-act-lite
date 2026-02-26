'use client';

export default function StatsCards({ stats, onFilter, activeFilter }) {
	const cards = [
		{ key: 'pending',  filterValue: 'pending',  className: 'stat-pending',  label: 'Pending' },
		{ key: 'approved', filterValue: 'approved', className: 'stat-approved', label: 'Approved' },
		{ key: 'denied',   filterValue: 'denied',   className: 'stat-denied',   label: 'Denied' },
		{ key: 'total',    filterValue: 'all',       className: 'stat-total',    label: 'Total' },
	];

	return (
		<div className="stats-grid">
			{cards.map(({ key, filterValue, className, label }) => {
				const isActive = activeFilter === filterValue;
				return (
					<button
						key={key}
						className={`stat-card ${className}${isActive ? ' stat-card-active' : ''}`}
						onClick={() => onFilter(filterValue)}
						aria-pressed={isActive}
						aria-label={`Filter by ${label} — ${stats[key]} ${label.toLowerCase()} event${stats[key] !== 1 ? 's' : ''}`}
					>
						<span className="stat-number">{stats[key]}</span>
						<span className="stat-label">{label}</span>
					</button>
				);
			})}
		</div>
	);
}
