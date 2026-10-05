from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials
import pandas as pd
import streamlit as st

st.set_page_config(
    page_title="Fleet & Operations Control",
    layout="wide",
    page_icon="🚚",
)


@st.cache_resource
def init_connection():
  scope = [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
  ]
  creds_dict = dict(st.secrets["gcp_service_account"])
  creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
  client = gspread.authorize(creds)
  return client


try:
  client = init_connection()
  # Open sheets by name
  sh = client.open("Branis Recycling Tool Management System")
  sheet = sh.worksheet("Fleet_Registry")
  log_sheet = sh.worksheet("Maintenance_Log")
  fuel_sheet = sh.worksheet("Fuel_Log")


  @st.cache_data(ttl=60)
  def load_data():
    return pd.DataFrame(sheet.get_all_records()), pd.DataFrame(
        fuel_sheet.get_all_records()
    )


  df, fuel_df = load_data()
except Exception as e:
  st.error(
      "Could not connect to Google Sheets. Check secrets configuration."
      f" Details: {e}"
  )
  # Fallback sample data for local testing
  df = pd.DataFrame({
      "Vehicle_ID": ["TRK-01", "4X4-02", "TRK-03"],
      "Type": ["Heavy Truck", "Light 4x4", "Heavy Truck"],
      "Assigned_Driver": ["John Doe", "Jane Smith", "Unassigned"],
      "Current_Reading": [48500, 9800, 29000],
      "Service_Interval": [10000, 5000, 10000],
      "Last_Service_Reading": [40000, 5000, 20000],
  })
  fuel_df = pd.DataFrame(
      columns=["Date", "Vehicle_ID", "Driver", "Litres_Filled", "Total_Cost", "Odometer"]
  )

st.title("🚗 Fleet Maintenance & Operations Control")
st.markdown(
    "Live operational tracker managing maintenance schedules, drivers, and"
    " fuel."
)

# --- CALCULATE SERVICE METRICS ---
df["Next_Service_Due"] = df["Last_Service_Reading"] + df["Service_Interval"]
df["Remaining"] = df["Next_Service_Due"] - df["Current_Reading"]

# --- SIDEBAR ACTIONS ---
st.sidebar.header("Operations Control")
action = st.sidebar.radio(
    "Select Action",
    [
        "View Dashboard",
        "Update Meter / Driver",
        "Log Service",
        "Log Fuel Fill-Up",
    ],
)

if action == "Update Meter / Driver":
  st.sidebar.subheader("Update Vehicle Details")
  selected_vehicle = st.sidebar.selectbox(
      "Select Vehicle", df["Vehicle_ID"].tolist()
  )

  current_row = df[df["Vehicle_ID"] == selected_vehicle].iloc[0]
  new_reading = st.sidebar.number_input(
      "Current Odometer / Hours",
      min_value=int(current_row["Current_Reading"]),
      value=int(current_row["Current_Reading"]),
  )
  new_driver = st.sidebar.text_input(
      "Assigned Driver", value=str(current_row["Assigned_Driver"])
  )

  if st.sidebar.button("Save Updates"):
    row_idx = df[df["Vehicle_ID"] == selected_vehicle].index[0] + 2
    # Assuming columns: Vehicle_ID(1), Type(2), Assigned_Driver(3), Current_Reading(4), Service_Interval(5), Last_Service_Reading(6)
    sheet.update_cell(row_idx, 3, new_driver)
    sheet.update_cell(row_idx, 4, new_reading)
    st.sidebar.success(f"Updated {selected_vehicle} successfully!")
    st.rerun()

elif action == "Log Service":
  st.sidebar.subheader("Record Maintenance Performed")
  serv_vehicle = st.sidebar.selectbox(
      "Vehicle Serviced", df["Vehicle_ID"].tolist(), key="serv_veh"
  )
  serv_type = st.sidebar.selectbox(
      "Service Type", ["A-Service (Light)", "B-Service (Major)", "Repair"]
  )
  parts_used = st.sidebar.text_input("Parts Replaced / Notes")
  cost = st.sidebar.number_input("Cost ($)", min_value=0.0)
  tech = st.sidebar.text_input("Technician / Shop Name")

  if st.sidebar.button("Commit Service Log"):
    log_sheet.append_row([
        str(datetime.now().date()),
        serv_vehicle,
        serv_type,
        parts_used,
        cost,
        tech,
    ])
    current_val = int(
        df.loc[df["Vehicle_ID"] == serv_vehicle, "Current_Reading"].values[0]
    )
    row_idx = df[df["Vehicle_ID"] == serv_vehicle].index[0] + 2
    sheet.update_cell(row_idx, 6, current_val)  # Last_Service_Reading is col 6
    st.sidebar.success("Service logged and interval reset!")
    st.rerun()

elif action == "Log Fuel Fill-Up":
  st.sidebar.subheader("Record Fuel Dispense")
  fuel_vehicle = st.sidebar.selectbox(
      "Vehicle", df["Vehicle_ID"].tolist(), key="fuel_veh"
  )
  current_driver = df.loc[
      df["Vehicle_ID"] == fuel_vehicle, "Assigned_Driver"
  ].values[0]
  fuel_driver = st.sidebar.text_input("Driver", value=str(current_driver))
  litres = st.sidebar.number_input("Litres Filled", min_value=0.0)
  total_cost = st.sidebar.number_input("Total Cost ($)", min_value=0.0)
  current_odometer = int(
      df.loc[df["Vehicle_ID"] == fuel_vehicle, "Current_Reading"].values[0]
  )
  fill_odometer = st.sidebar.number_input(
      "Odometer at Fill",
      min_value=current_odometer,
      value=current_odometer,
  )

  if st.sidebar.button("Record Fuel"):
    fuel_sheet.append_row([
        str(datetime.now().date()),
        fuel_vehicle,
        fuel_driver,
        litres,
        total_cost,
        fill_odometer,
    ])
    st.sidebar.success("Fuel log recorded!")
    st.rerun()

# --- MAIN DASHBOARD VIEW ---
tab1, tab2 = st.tabs(["📊 Fleet Status & Maintenance", "⛽ Fuel Logs"])

with tab1:
  st.subheader("Vehicle Registry & Service Status")


  def highlight_urgency(val):
    color = "red" if val <= 0 else ("orange" if val <= 1000 else "green")
    return f"color: {color}"


  st.dataframe(
      df.style.applymap(highlight_urgency, subset=["Remaining"]),
      use_container_width=True,
  )

  overdue = df[df["Remaining"] <= 0]
  due_soon = df[(df["Remaining"] > 0) & (df["Remaining"] <= 1000)]

  col1, col2 = st.columns(2)
  with col1:
    if not overdue.empty:
      st.error(
          f"🚨 **Urgent:** {len(overdue)} vehicle(s) overdue for service!"
      )
      st.dataframe(overdue[["Vehicle_ID", "Assigned_Driver", "Remaining"]])
    else:
      st.success("No vehicles currently overdue.")

  with col2:
    if not due_soon.empty:
      st.warning(
          f"⚠️ **Warning:** {len(due_soon)} vehicle(s) approaching service limit."
      )
      st.dataframe(due_soon[["Vehicle_ID", "Assigned_Driver", "Remaining"]])
    else:
      st.info("All vehicles have healthy maintenance buffers.")

with tab2:
  st.subheader("Recent Fuel Transactions")
  if not fuel_df.empty:
    st.dataframe(fuel_df, use_container_width=True)
    total_spend = fuel_df["Total_Cost"].sum() if "Total_Cost" in fuel_df.columns else 0
    total_litres = (
        fuel_df["Litres_Filled"].sum() if "Litres_Filled" in fuel_df.columns else 0
    )
    st.metric(
        label="Total Fleet Fuel Spend",
        value=f"${total_spend:,.2f}",
        delta=f"{total_litres:,.1f} Litres Consumed",
    )
  else:
    st.info("No fuel logs recorded yet.")