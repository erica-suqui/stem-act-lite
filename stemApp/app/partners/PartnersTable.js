'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import Toast from '../components/Toast';

const STATUS_META = {
	active:   { Icon: CheckCircle, label: 'Active' },
	pending:  { Icon: Clock,       label: 'Pending' },
	disabled: { Icon: XCircle,     label: 'Disabled' },
};

export default function PartnersTable({ organizations }) {
	const router = useRouter();
	const [search, setSearch] = useState('');
	const [loadingId, setLoadingId] = useState(null);
	const [toasts, setToasts] = useState([]);

	function addToast(message, type = 'success') {
		const id = Date.now();
		setToasts(prev => [...prev, { id, message, type }]);
		if (type === 'success') {
			setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
		}
		// Errors persist until manually dismissed
	}

	function dismissToast(id) {
		setToasts(prev => prev.filter(t => t.id !== id));
	}

	const filtered = organizations.filter(org => {
		const q = search.toLowerCase();
		return (
			org.org_name.toLowerCase().includes(q) ||
			org.contact_email.toLowerCase().includes(q)
		);
	});

	const updateStatus = useCallback(async (orgId, orgName, status) => {
		setLoadingId(orgId);
		try {
			const res = await fetch(`/api/organizations/${orgId}/status`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status }),
			});
			const data = await res.json();
			if (data.success) {
				addToast(`${orgName} has been set to ${status}.`, 'success');
				router.refresh();
			} else {
				addToast('Error: ' + data.message, 'error');
			}
		} catch {
			addToast('Network error. Please try again.', 'error');
		} finally {
			setLoadingId(null);
		}
	}, [router]);

	return (
		<>
			<div className="filter-bar" aria-label="Search partners">
				<label htmlFor="partner-search">Search:</label>
				<input
					id="partner-search"
					type="search"
					value={search}
					onChange={e => setSearch(e.target.value)}
					placeholder="Organization name or email…"
					aria-label="Search by organization name or email"
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
									<td><strong>{org.org_name}</strong></td>
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
										{org.status !== 'active' && (
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
								<td colSpan={6} className="no-data">
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
