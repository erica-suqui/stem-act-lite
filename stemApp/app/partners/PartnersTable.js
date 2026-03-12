'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import Toast from '../components/Toast';
import { useToast } from '@/hooks/useToast';
import { apiUrl } from '@/lib/api';
import { formatFullName } from '@/lib/utils';

const STATUS_META = {
	active:   { Icon: CheckCircle, label: 'Active' },
	pending:  { Icon: Clock,       label: 'Pending' },
	disabled: { Icon: XCircle,     label: 'Disabled' },
};

const STAT_CARDS = [
	{ filterValue: 'all',      className: 'stat-total',    label: 'Total',    key: 'total' },
	{ filterValue: 'pending',  className: 'stat-pending',  label: 'Pending',  key: 'pending' },
	{ filterValue: 'active',   className: 'stat-approved', label: 'Active',   key: 'active' },
	{ filterValue: 'disabled', className: 'stat-denied',   label: 'Disabled', key: 'disabled' },
];

export default function PartnersTable({ organizations: initialOrganizations }) {
	const [organizations, setOrganizations] = useState(initialOrganizations);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [loadingId, setLoadingId] = useState(null);
	const { toasts, addToast, dismissToast } = useToast();

	const stats = {
		total:    organizations.length,
		active:   organizations.filter(o => o.status === 'active').length,
		pending:  organizations.filter(o => o.status === 'pending').length,
		disabled: organizations.filter(o => o.status === 'disabled').length,
	};

	const filtered = organizations.filter(org => {
		const q = search.toLowerCase();
		const contactName = formatFullName(org.contact_first_name, org.contact_last_name).toLowerCase();
		const matchSearch = org.org_name.toLowerCase().includes(q)
			|| contactName.includes(q)
			|| org.contact_email.toLowerCase().includes(q);
		const matchStatus = statusFilter === 'all' || org.status === statusFilter;
		return matchSearch && matchStatus;
	});

	const updateStatus = useCallback(async (orgId, orgName, status) => {
		setLoadingId(orgId);
		try {
			const res = await fetch(apiUrl(`/api/organizations/${orgId}/status`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status }),
			});
			const data = await res.json();
			if (data.success) {
				setOrganizations(prev => prev.map(o => o.org_id === orgId ? { ...o, status } : o));
				addToast(`${orgName} has been set to ${status}.`, 'success');
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, []);

	return (
		<>
			<div className="stats-grid">
				{STAT_CARDS.map(({ filterValue, className, label, key }) => {
					const isActive = statusFilter === filterValue;
					return (
						<button
							key={key}
							className={`stat-card ${className}${isActive ? ' stat-card-active' : ''}`}
							onClick={() => setStatusFilter(filterValue)}
							aria-pressed={isActive}
							aria-label={`Filter by ${label} — ${stats[key]} ${label.toLowerCase()} organization${stats[key] !== 1 ? 's' : ''}`}
						>
							<span className="stat-number">{stats[key]}</span>
							<span className="stat-label">{label}</span>
						</button>
					);
				})}
			</div>

			<div className="filter-bar" aria-label="Search partners">
				<label htmlFor="partner-search">Search:</label>
				<input
					id="partner-search"
					type="search"
					value={search}
					onChange={e => setSearch(e.target.value)}
					placeholder="Organization, contact name, or email…"
					aria-label="Search by organization name, contact name, or email"
					className="search-input"
					autoComplete="off"
				/>
				<span className="result-count" aria-live="polite" aria-atomic="true">
					{filtered.length} {filtered.length === 1 ? 'result' : 'results'}
				</span>
			</div>

			<div className="table-wrapper">
				<table className="data-table">
					<caption className="table-caption">
						Partner organizations — {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
					</caption>
					<thead>
						<tr>
							<th scope="col">Organization</th>
							<th scope="col">Contact Name</th>
							<th scope="col">Contact Email</th>
							<th scope="col">Phone</th>
							<th scope="col">Events</th>
							<th scope="col">Status</th>
							<th scope="col">Actions</th>
						</tr>
					</thead>
					<tbody>
						{filtered.map(org => {
							const isLoading = loadingId === org.org_id;
							const statusMeta = STATUS_META[org.status] || { Icon: null, label: org.status };
							const StatusIcon = statusMeta.Icon;
							return (
								<tr key={org.org_id}>
									<td>
									<Link href={`/partners/${org.org_id}`}>
										<strong>{org.org_name}</strong>
									</Link>
								</td>
									<td>{formatFullName(org.contact_first_name, org.contact_last_name)}</td>
									<td>
										<a
											href={`mailto:${org.contact_email}`}
											aria-label={`Email ${org.org_name} at ${org.contact_email}`}
										>
											{org.contact_email}
										</a>
									</td>
									<td>{org.contact_phone || '—'}</td>
									<td>
										{org.event_count > 0 ? (
											<>
												<span>{org.event_count} total</span>
												{org.pending_count > 0 && (
													<>
														<br />
														<small>{org.pending_count} pending</small>
													</>
												)}
											</>
										) : (
											<span style={{ color: '#999' }}>—</span>
										)}
									</td>
									<td>
										<span className={`status-badge status-${org.status}`}>
											{StatusIcon && (
												<StatusIcon size={12} aria-hidden="true" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
											)}
											{statusMeta.label}
										</span>
									</td>
									<td className="actions-cell">
										{org.status === 'pending' && (
											<button
												className={`btn btn-approve${isLoading ? ' btn-loading' : ''}`}
												onClick={() => updateStatus(org.org_id, org.org_name, 'active')}
												disabled={isLoading}
												aria-label={`Activate ${org.org_name}`}
											>
												Activate
											</button>
										)}
										{org.status === 'active' && (
											<button
												className={`btn btn-deny${isLoading ? ' btn-loading' : ''}`}
												onClick={() => updateStatus(org.org_id, org.org_name, 'disabled')}
												disabled={isLoading}
												aria-label={`Disable ${org.org_name}`}
											>
												Disable
											</button>
										)}
										{org.status === 'disabled' && (
											<button
												className={`btn btn-details${isLoading ? ' btn-loading' : ''}`}
												onClick={() => updateStatus(org.org_id, org.org_name, 'pending')}
												disabled={isLoading}
												aria-label={`Set ${org.org_name} back to pending`}
											>
												Set Pending
											</button>
										)}
									</td>
								</tr>
							);
						})}
						{filtered.length === 0 && (
							<tr>
								<td colSpan={7} className="no-data">
									No organizations match your search.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>

			<Toast toasts={toasts} onDismiss={dismissToast} />
		</>
	);
}
