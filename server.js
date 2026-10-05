const express = require('express');
const path = require('path');
const { initDB, all, run } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const serviceThresholds = {
  A: { km: 5000, hours: 250 },
  B: { km: 15000, hours: 500 },
  C: { km: 30000, hours: 1000 },
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getVehicleServiceSummary(vehicle, services) {
  const byType = {
    A: null,
    B: null,
    C: null,
  };

  for (const service of services) {
    if (service.vehicle_id !== vehicle.id) continue;
    if (byType[service.service_type] === null || new Date(service.performed_at) > new Date(byType[service.service_type].performed_at)) {
      byType[service.service_type] = service;
    }
  }

  let highestDue = null;

  for (const [type, limits] of Object.entries(serviceThresholds)) {
    const lastService = byType[type];
    const odometerDelta = lastService ? vehicle.odometer_km - lastService.odometer_km : vehicle.odometer_km;
    const hoursDelta = lastService ? vehicle.operating_hours - lastService.operating_hours : vehicle.operating_hours;
    const kmRatio = odometerDelta / limits.km;
    const hourRatio = hoursDelta / limits.hours;
    const ratio = Math.max(kmRatio, hourRatio);

    if (!highestDue || ratio > highestDue.ratio) {
      highestDue = {
        type,
        ratio,
        odometerDelta,
        hoursDelta,
        lastService,
      };
    }
  }

  return highestDue;
}

async function getOverview() {
  const vehicles = await all('SELECT * FROM vehicles ORDER BY name');
  const services = await all('SELECT * FROM maintenance_services ORDER BY performed_at DESC');
  const inspections = await all('SELECT * FROM inspections ORDER BY performed_at DESC');
  const parts = await all('SELECT * FROM inventory ORDER BY category, name');
  const compliance = await all('SELECT * FROM compliance_documents ORDER BY expiry_date ASC');

  const alerts = vehicles.map((vehicle) => {
    const dueInfo = getVehicleServiceSummary(vehicle, services);
    const status = dueInfo && dueInfo.ratio >= 1 ? 'Due now' : dueInfo && dueInfo.ratio >= 0.8 ? 'Due soon' : 'On schedule';
    return {
      vehicle_id: vehicle.id,
      vehicle_name: vehicle.name,
      service_type: dueInfo ? dueInfo.type : 'A',
      status,
      ratio: dueInfo ? dueInfo.ratio : 0,
      odometer_km: vehicle.odometer_km,
      operating_hours: vehicle.operating_hours,
      last_service: dueInfo && dueInfo.lastService ? dueInfo.lastService.performed_at : 'No service record',
    };
  });

  const dueNowCount = alerts.filter((alert) => alert.status === 'Due now').length;
  const dueSoonCount = alerts.filter((alert) => alert.status === 'Due soon').length;
  const maintenanceSpend = services.reduce((total, item) => total + Number(item.cost || 0), 0);

  return {
    vehicles,
    services,
    inspections,
    parts,
    compliance,
    alerts,
    summary: {
      total_vehicles: vehicles.length,
      due_now: dueNowCount,
      due_soon: dueSoonCount,
      maintenance_spend: maintenanceSpend,
      inventory_items: parts.length,
    },
  };
}

app.get('/api/overview', async (req, res) => {
  try {
    const overview = await getOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicles', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM vehicles ORDER BY name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vehicles', async (req, res) => {
  try {
    const { name, make, model, year, license_plate, vin, odometer_km, operating_hours, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Vehicle name is required.' });

    const result = await run(
      `INSERT INTO vehicles (name, make, model, year, license_plate, vin, odometer_km, operating_hours, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, make || '', model || '', year || null, license_plate || '', vin || '', Number(odometer_km || 0), Number(operating_hours || 0), status || 'active']
    );

    res.status(201).json({ id: result.id, message: 'Vehicle created successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vehicles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, make, model, year, license_plate, vin, odometer_km, operating_hours, status } = req.body;

    await run(
      `UPDATE vehicles
       SET name = ?, make = ?, model = ?, year = ?, license_plate = ?, vin = ?, odometer_km = ?, operating_hours = ?, status = ?
       WHERE id = ?`,
      [name, make || '', model || '', year || null, license_plate || '', vin || '', Number(odometer_km || 0), Number(operating_hours || 0), status || 'active', id]
    );

    res.json({ message: 'Vehicle updated successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehicles/:id', async (req, res) => {
  try {
    await run('DELETE FROM maintenance_services WHERE vehicle_id = ?', [req.params.id]);
    await run('DELETE FROM inspections WHERE vehicle_id = ?', [req.params.id]);
    await run('DELETE FROM compliance_documents WHERE vehicle_id = ?', [req.params.id]);
    await run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Vehicle deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM maintenance_services ORDER BY performed_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const { vehicle_id, service_type, performed_at, odometer_km, operating_hours, technician, cost, parts_replaced, notes } = req.body;

    if (!vehicle_id || !service_type || !performed_at) {
      return res.status(400).json({ error: 'vehicle_id, service_type, and performed_at are required.' });
    }

    const result = await run(
      `INSERT INTO maintenance_services (vehicle_id, service_type, performed_at, odometer_km, operating_hours, technician, cost, parts_replaced, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vehicle_id, service_type, performed_at, Number(odometer_km || 0), Number(operating_hours || 0), technician || '', Number(cost || 0), parts_replaced || '', notes || '']
    );

    res.status(201).json({ id: result.id, message: 'Service recorded successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inspections', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM inspections ORDER BY performed_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/inspections', async (req, res) => {
  try {
    const { vehicle_id, inspection_type, performed_at, operator_name, passed, findings, action_required } = req.body;

    if (!vehicle_id || !inspection_type || !performed_at) {
      return res.status(400).json({ error: 'vehicle_id, inspection_type, and performed_at are required.' });
    }

    const result = await run(
      `INSERT INTO inspections (vehicle_id, inspection_type, performed_at, operator_name, passed, findings, action_required)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vehicle_id, inspection_type, performed_at, operator_name || '', passed === 'true' || passed === true ? 1 : 0, findings || '', action_required || '']
    );

    res.status(201).json({ id: result.id, message: 'Inspection logged successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/parts', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM inventory ORDER BY category, name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/parts', async (req, res) => {
  try {
    const { name, category, quantity, reorder_level, location, unit_cost } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Part name and category are required.' });
    }

    const result = await run(
      `INSERT INTO inventory (name, category, quantity, reorder_level, location, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, category, Number(quantity || 0), Number(reorder_level || 0), location || '', Number(unit_cost || 0)]
    );

    res.status(201).json({ id: result.id, message: 'Inventory item added.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compliance', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM compliance_documents ORDER BY expiry_date ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compliance', async (req, res) => {
  try {
    const { vehicle_id, document_type, title, reference_number, expiry_date, notes } = req.body;

    if (!vehicle_id || !document_type || !title) {
      return res.status(400).json({ error: 'Vehicle, document type, and title are required.' });
    }

    const result = await run(
      `INSERT INTO compliance_documents (vehicle_id, document_type, title, reference_number, expiry_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [vehicle_id, document_type, title, reference_number || '', expiry_date || '', notes || '']
    );

    res.status(201).json({ id: result.id, message: 'Compliance record created.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/alerts', async (req, res) => {
  try {
    const overview = await getOverview();
    res.json(overview.alerts.filter((alert) => alert.status !== 'On schedule'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Fleet maintenance system running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
