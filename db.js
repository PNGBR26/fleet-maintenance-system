const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fleet.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`PRAGMA foreign_keys = ON;`);

      db.run(`
        CREATE TABLE IF NOT EXISTS vehicles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          make TEXT,
          model TEXT,
          year INTEGER,
          license_plate TEXT,
          vin TEXT,
          odometer_km INTEGER DEFAULT 0,
          operating_hours INTEGER DEFAULT 0,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS maintenance_services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          service_type TEXT NOT NULL,
          performed_at TEXT NOT NULL,
          odometer_km INTEGER NOT NULL,
          operating_hours INTEGER NOT NULL,
          technician TEXT,
          cost REAL DEFAULT 0,
          parts_replaced TEXT,
          notes TEXT,
          FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inspections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          inspection_type TEXT NOT NULL,
          performed_at TEXT NOT NULL,
          operator_name TEXT,
          passed INTEGER DEFAULT 1,
          findings TEXT,
          action_required TEXT,
          FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          quantity INTEGER DEFAULT 0,
          reorder_level INTEGER DEFAULT 0,
          location TEXT,
          unit_cost REAL DEFAULT 0,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS compliance_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehicle_id INTEGER NOT NULL,
          document_type TEXT NOT NULL,
          title TEXT NOT NULL,
          reference_number TEXT,
          expiry_date TEXT,
          notes TEXT,
          FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
        );
      `);

      db.run(`
        INSERT OR IGNORE INTO vehicles (id, name, make, model, year, license_plate, vin, odometer_km, operating_hours, status)
        VALUES
          (1, 'Truck 01', 'Mack', 'MD6', 2021, 'CA-2411', '1M1A1MACK0001', 45230, 1480, 'active'),
          (2, 'Utility 04', 'Toyota', 'Hilux 4x4', 2020, 'NW-5879', '1T2HILUX0004', 28740, 960, 'active'),
          (3, 'Support Van', 'Ford', 'Transit', 2022, 'QH-1054', '1FTRTRANSIT0003', 31600, 1225, 'maintenance');
      `);

      db.run(`
        INSERT OR IGNORE INTO maintenance_services (id, vehicle_id, service_type, performed_at, odometer_km, operating_hours, technician, cost, parts_replaced, notes)
        VALUES
          (1, 1, 'A', '2025-08-18', 40000, 1200, 'J. Smith', 540, 'Oil filter, engine oil', 'Routine service completed on schedule.'),
          (2, 1, 'B', '2025-02-11', 35000, 980, 'Fleet Centre', 1180, 'Air filter, brake pads, tires rotated', 'Major service with suspension inspection.'),
          (3, 2, 'A', '2025-09-10', 25000, 820, 'R. Parker', 480, 'Oil and fuel filter', 'Completed during planned downtime.'),
          (4, 3, 'A', '2025-07-04', 28000, 865, 'J. Abbott', 560, 'Oil, oil filter, cabin filter', 'Regular maintenance review.');
      `);

      db.run(`
        INSERT OR IGNORE INTO inspections (id, vehicle_id, inspection_type, performed_at, operator_name, passed, findings, action_required)
        VALUES
          (1, 1, 'Pre-Trip', '2026-10-01', 'K. Daniels', 1, 'No defects noted. Fluids and tires checked.', 'None'),
          (2, 1, 'Post-Trip', '2026-10-01', 'K. Daniels', 1, 'Return condition normal.', 'Monitor rear brake temperature.'),
          (3, 2, 'Pre-Trip', '2026-10-02', 'N. Patel', 0, 'Low tire pressure on rear left.', 'Inflate and recheck before next dispatch.');
      `);

      db.run(`
        INSERT OR IGNORE INTO inventory (id, name, category, quantity, reorder_level, location, unit_cost)
        VALUES
          (1, 'Engine Oil 15W-40', 'Lubricants', 18, 8, 'Bay A', 32.50),
          (2, 'Oil Filter', 'Filters', 12, 6, 'Quick Access Rack', 18.00),
          (3, 'Air Filter', 'Filters', 9, 5, 'Bay C', 26.00),
          (4, 'Fuel Filter', 'Filters', 7, 6, 'Bay C', 22.00),
          (5, 'Brake Pad Set', 'Brake Components', 4, 2, 'Parts Locker 2', 120.00),
          (6, 'Headlight Bulb', 'Electrical', 10, 4, 'Parts Locker 1', 14.00),
          (7, 'Wiper Blade', 'Cabin Safety', 8, 4, 'Parts Locker 1', 16.50);
      `);

      db.run(`
        INSERT OR IGNORE INTO compliance_documents (id, vehicle_id, document_type, title, reference_number, expiry_date, notes)
        VALUES
          (1, 1, 'Registration', 'Vehicle registration certificate', 'REG-2241', '2027-02-01', 'Maintained in fleet file.'),
          (2, 1, 'Roadworthiness', 'Annual inspection certificate', 'ROA-5578', '2026-12-15', 'Upcoming inspection due before year-end.'),
          (3, 2, 'Insurance', 'Public liability cover note', 'INS-3321', '2026-11-30', 'Renewal review scheduled.');
      `);

      db.run('SELECT 1', [], () => resolve());
    });
  });
}

module.exports = {
  db,
  run,
  all,
  initDB,
};
