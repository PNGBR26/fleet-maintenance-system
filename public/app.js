* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f5f7fb;
  color: #1d2433;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: #132238;
  color: white;
}

.topbar h1 {
  margin: 0;
  font-size: 2rem;
}

.topbar p {
  margin: 5px 0 0;
  opacity: 0.8;
}

button {
  background: #2a6bf2;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
}

button:hover {
  background: #1854c7;
}

.page {
  padding: 20px 30px 40px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.summary-card {
  background: white;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.summary-card .label {
  display: block;
  color: #5d677a;
  font-size: 0.8rem;
  margin-bottom: 8px;
}

.summary-card .value {
  font-size: 2rem;
  font-weight: 700;
}

.panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.two-column {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.forms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid #d8dfe9;
  border-radius: 8px;
  padding: 10px 12px;
  font: inherit;
}

textarea {
  min-height: 80px;
  resize: vertical;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

th,
td {
  text-align: left;
  border-bottom: 1px solid #edf1f7;
  padding: 10px 8px;
}

th {
  color: #59667d;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.alert-list {
  list-style: none;
  padding-left: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-list li {
  background: #f9fafc;
  border-left: 4px solid #f7b500;
  border-radius: 8px;
  padding: 12px;
}

.alert-list li.due {
  border-left-color: #d23d3d;
}

.alert-list li.good {
  border-left-color: #1ea776;
}

.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #eaf5ff;
  color: #175fbe;
}

.status-badge.due {
  background: #ffe0e0;
  color: #8f1f1f;
}

.status-badge.good {
  background: #e8f9ef;
  color: #107d52;
}

@media (max-width: 768px) {
  .two-column {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
