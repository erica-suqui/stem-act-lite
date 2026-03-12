import { formatFullName } from '@/lib/utils';

export default function OrganizationsTable({ organizations }) {
	return (
		<div className="table-wrapper">
			<table className="data-table">
				<thead>
					<tr>
						<th>Organization</th>
						<th>Contact Name</th>
						<th>Contact Email</th>
						<th>Phone</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{organizations.map(org => (
						<tr key={org.org_id}>
							<td>{org.org_name}</td>
							<td>{formatFullName(org.contact_first_name, org.contact_last_name)}</td>
							<td>
								<a href={`mailto:${org.contact_email}`}>{org.contact_email}</a>
							</td>
							<td>{org.contact_phone || '—'}</td>
							<td>
								<span className={`status-badge status-${org.status}`}>
									{org.status}
								</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
