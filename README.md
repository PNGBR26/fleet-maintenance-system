const summaryGrid = document.getElementById('summaryGrid');
const fleetTableBody = document.getElementById('fleetTableBody');
const alertList = document.getElementById('alertList');
const serviceHistoryBody = document.getElementById('serviceHistoryBody');
const complianceBody = document.getElementById('complianceBody');
const serviceVehicleSelect = document.getElementById('serviceVehicleSelect');
const inspectionVehicleSelect = document.getElementById('inspectionVehicleSelect');

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed');
  return payload;
}

function renderSummary(data) {
  const cards = [
    { label: 'Total Vehicles', value: data.summary.total_vehicles },
    { label: 'Due Now', value: data.summary.due_now },
    { label: 'Due Soon', value: data.summary.due_soon },
    { label: 'Maintenance Spend', value: `$${Number(data.summary.maintenance_spend).toFixed(2)}` },
    { label: 'Inventory Items', value: data.summary.inventory_items },
  ];

  summaryGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="summary-card">
          <span class="label">${card.label}</span>
          <span class="value">${card.value}</span>
        </div>
      `
    )
    .join('');
}

function renderFleetTable(vehicles, alerts) {
  fleetTableBody.innerHTML = vehicles
    .map((vehicle) => {
      const alert = alerts.find((item) => item.vehicle_id === vehicle.id) || null;
      const status = alert && alert.status !== 'On schedule' ? alert.status : 'On schedule';
      const badgeClass = status === 'Due now' ? 'due' : status === 'Due soon' ? '' : 'good';
      return `
        <tr>
          <td>${vehicle.name}</td>
          <td>${vehicle.make} ${vehicle.model}</td>
          <td>${vehicle.odometer_km.toLocaleString()} km</td>
          <td>${vehicle.operating_hours} hrs</td>
          <td><span class="status-badge ${badgeClass}">${status}</span></td>
        </tr>
      `;
    })
    .join('');
}

function renderAlerts(alerts) {
  if (!alerts.length) {
    alertList.innerHTML = '<li class="good">No active maintenance alerts.</li>';
    return;
  }

  alertList.innerHTML = alerts
    .map((alert) => {
      const dueClass = alert.status === 'Due now' ? 'due' : 'good';
      return `
        <li class="${dueClass}">
          <strong>${alert.vehicle_name}</strong> – ${alert.service_type} Service<br />
          ${alert.status} • ${Math.max(alert.ratio, 0).toFixed(1)}x threshold reached
        </li>
      `;
    })
    .join('');
}

function renderServiceHistory(services, vehicles) {
  const getName = (vehicleId) => vehicles.find((vehicle) => vehicle.id === vehicleId)?.name || 'Unknown';

  serviceHistoryBody.innerHTML = services
    .slice(0, 15)
    .map(
      (service) => `
        <tr>
          <td>${getName(service.vehicle_id)}</td>
          <td>${service.service_type}</td>
          <td>${service.performed_at}</td>
          <td>${Number(service.odometer_km).toLocaleString()} km</td>
          <td>${service.operating_hours} hrs</td>
          <td>$${Number(service.cost || 0).toFixed(2)}</td>
          <td>${service.technician || 'Unassigned'}</td>
        </tr>
      `
    )
    .join('');
}

function renderCompliance(compliance, vehicles) {
  const getName = (vehicleId) => vehicles.find((vehicle) => vehicle.id === vehicleId)?.name || 'Unknown';

  complianceBody.innerHTML = compliance
    .slice(0, 15)
    .map(
      (doc) => `
        <tr>
          <td>${getName(doc.vehicle_id)}</td>
          <td>${doc.document_type} / ${doc.title}</td>
          <td>${doc.reference_number || '—'}</td>
          <td>${doc.expiry_date || '—'}</td>
          <td>${doc.notes || '—'}</td>
        </tr>
      `
    )
    .join('');
}

function populateVehicleSelects(vehicles) {
  const options = vehicles
    .map((vehicle) => `<option value="${vehicle.id}">${vehicle.name}</option>`)
    .join('');

  serviceVehicleSelect.innerHTML = options;
  inspectionVehicleSelect.innerHTML = options;
}

async function loadOverview() {
  const data = await fetchJson('/api/overview');
  renderSummary(data);
  renderFleetTable(data.vehicles, data.alerts);
  renderAlerts(data.alerts.filter((alert) => alert.status !== 'On schedule'));
  renderServiceHistory(data.services, data.vehicles);
  renderCompliance(data.compliance, data.vehicles);
  populateVehicleSelects(data.vehicles);
}

async function handleVehicleSubmit(event) {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target));
  await fetchJson('/api/vehicles', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  event.target.reset();
  loadOverview();
}

async function handleServiceSubmit(event) {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target));
  await fetchJson('/api/services', {
    method: 'POST',
    body: JSON.stringify({
      ...formData,
      vehicle_id: Number(formData.vehicle_id),
      odometer_km: Number(formData.odometer_km || 0),
      operating_hours: Number(formData.operating_hours || 0),
      cost: Number(formData.cost || 0),
    }),
  });
  event.target.reset();
  loadOverview();
}

async function handleInspectionSubmit(event) {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target));
  await fetchJson('/api/inspections', {
    method: 'POST',
    body: JSON.stringify({
      ...formData,
      vehicle_id: Number(formData.vehicle_id),
      passed: formData.passed === 'true',
    }),
  });
  event.target.reset();
  loadOverview();
}

async function handlePartsSubmit(event) {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(event.target));
  await fetchJson('/api/parts', {
    method: 'POST',
    body: JSON.stringify({
      ...formData,
      quantity: Number(formData.quantity || 0),
      reorder_level: Number(formData.reorder_level || 0),
      unit_cost: Number(formData.unit_cost || 0),
    }),
  });
  event.target.reset();
  loadOverview();
}

document.getElementById('vehicleForm').addEventListener('submit', handleVehicleSubmit);
document.getElementById('serviceForm').addEventListener('submit', handleServiceSubmit);
document.getElementById('inspectionForm').addEventListener('submit', handleInspectionSubmit);
document.getElementById('partsForm').addEventListener('submit', handlePartsSubmit);
document.getElementById('refreshData').addEventListener('click', loadOverview);

loadOverview().catch((error) => {
  console.error(error);
  alert('Unable to load fleet data.');
});
