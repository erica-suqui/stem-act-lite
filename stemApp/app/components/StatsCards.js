'use client';

export default function StatsCards({ stats }) {
	return (
		<div className="stats-grid">
			<div className="stat-card stat-pending">
				<span className="stat-number">{stats.pending}</span>
				<span className="stat-label">Pending</span>
			</div>
			<div className="stat-card stat-approved">
				<span className="stat-number">{stats.approved}</span>
				<span className="stat-label">Approved</span>
			</div>
			<div className="stat-card stat-denied">
				<span className="stat-number">{stats.denied}</span>
				<span className="stat-label">Denied</span>
			</div>
			<div className="stat-card stat-total">
				<span className="stat-number">{stats.total}</span>
				<span className="stat-label">Total</span>
			</div>
		</div>
	);
}
