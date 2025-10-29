import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, ResponsiveContainer
} from "recharts";

function App() {
  const [districtA, setDistrictA] = useState("");
  const [districtB, setDistrictB] = useState("");
  const [districts, setDistricts] = useState([]);
  const [dataA, setDataA] = useState([]);
  const [dataB, setDataB] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch district list from government API
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await axios.get(
          "https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722?api-key=579b464db66ec23bdd000001d10b1b3eb59d41e046d0c2f3e0b50518&format=json&limit=1000"
        );
        const records = res.data.records || [];
        const unique = [...new Set(records.map((r) => r.district_name).filter(Boolean))].sort();
        setDistricts(unique);
      } catch {
        setError("Failed to load district list.");
      }
    };
    fetchDistricts();
  }, []);

  // Fetch data for each district from backend
  const fetchDistrictData = async (district) => {
    const res = await axios.get(`http://localhost:6001/api/district/${district}`);
    const records = Array.isArray(res.data) ? res.data : (res.data.records || []);
    const monthOrder = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
    return records.map((r) => ({
      fin_year: r.fin_year,
      month: r.month,
      district_name: r.district_name,
      avg_wage: parseFloat(r.Average_Wage_rate_per_day_per_person || 0),
      emp_days: Number(r.Average_days_of_employment_provided_per_Household || 0),
      completed: Number(r.Number_of_Completed_Works || 0),
      ongoing: Number(r.Number_of_Ongoing_Works || 0),
      total_exp: parseFloat(r.Total_Exp || 0),
      women_persondays: Number(r.Women_Persondays || 0),
    })).sort((a, b) => {
      if (a.fin_year === b.fin_year)
        return (monthOrder[a.month] || 0) - (monthOrder[b.month] || 0);
      return a.fin_year.localeCompare(b.fin_year);
    });
  };

  const fetchData = async () => {
    if (!districtA || !districtB) {
      setError("Please select both districts to compare.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const [resA, resB] = await Promise.all([
        fetchDistrictData(districtA),
        fetchDistrictData(districtB),
      ]);
      setDataA(resA);
      setDataB(resB);
    } catch {
      setError("Failed to fetch comparison data. Please try again.");
      setDataA([]);
      setDataB([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate district-level summary
  const calcSummary = (data) => {
    if (!data.length) return {};
    const total = (key) => data.reduce((sum, d) => sum + (d[key] || 0), 0);
    const avg = (key) => (total(key) / data.length).toFixed(2);
    return {
      avg_wage: avg("avg_wage"),
      emp_days: avg("emp_days"),
      completed: total("completed"),
      ongoing: total("ongoing"),
      total_exp: total("total_exp").toFixed(2),
      women_persondays: total("women_persondays"),
    };
  };

  const summaryA = calcSummary(dataA);
  const summaryB = calcSummary(dataB);

  // Insight generation
  const generateInsight = (district, data) => {
    if (!data.length) return "";
    const totalWomen = data.reduce((sum, d) => sum + d.women_persondays, 0);
    const totalEmp = data.reduce((sum, d) => sum + d.emp_days, 0);
    const percent = totalEmp ? ((totalWomen / totalEmp) * 100).toFixed(1) : 0;
    return `In ${district}, women contributed approximately ${percent}% of total employment persondays.`;
  };

  const insightA = generateInsight(districtA, dataA);
  const insightB = generateInsight(districtB, dataB);

  return (
    <div style={{ padding: 20, fontFamily: "Poppins, sans-serif", textAlign: "center" }}>
      <h1 style={{ color: "#0b5ed7" }}>Our Voice, Our Rights</h1>
      <p>District-level MGNREGA comparison dashboard</p>

      {/* District Selection */}
      <div style={{ marginBottom: 18 }}>
        <select value={districtA} onChange={(e)=>setDistrictA(e.target.value)}
          style={{ padding: 10, width: 220, borderRadius: 6, marginRight: 10 }}>
          <option value="">-- Select District A --</option>
          {districts.map((d,i)=> <option key={i} value={d}>{d}</option>)}
        </select>

        <select value={districtB} onChange={(e)=>setDistrictB(e.target.value)}
          style={{ padding: 10, width: 220, borderRadius: 6 }}>
          <option value="">-- Select District B --</option>
          {districts.map((d,i)=> <option key={i} value={d}>{d}</option>)}
        </select>

        <button onClick={fetchData}
          style={{ marginLeft: 10, padding: "10px 16px", background:"#0b5ed7", color:"#fff", border:"none", borderRadius:6 }}>
          {loading ? "Loading..." : "Compare"}
        </button>
      </div>

      {error && <div style={{ color:"crimson", marginBottom: 12 }}>{error}</div>}

      {/* 🔹 Summary Comparison Table */}
      {dataA.length > 0 && dataB.length > 0 && (
        <div style={{ maxWidth: 800, margin: "20px auto" }}>
          <h3 style={{ textAlign: "left" }}>Summary Comparison</h3>
          <table style={{ width:"100%", borderCollapse:"collapse", background:"#fff", boxShadow:"0 2px 6px rgba(0,0,0,0.05)" }}>
            <thead style={{ background:"#0b5ed7", color:"#fff" }}>
              <tr>
                <th style={cell}></th>
                <th style={cell}>{districtA}</th>
                <th style={cell}>{districtB}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(summaryA).map((key) => (
                <tr key={key}>
                  <td style={cell}>{key.replace(/_/g, " ").toUpperCase()}</td>
                  <td style={cell}>{summaryA[key]}</td>
                  <td style={cell}>{summaryB[key]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 🔹 Insights */}
      {(insightA || insightB) && (
        <div style={{ background:"#f1f8ff", padding:"10px 20px", borderRadius:8, width:"fit-content", margin:"0 auto 20px" }}>
          <div style={{ color:"#0b5ed7", fontWeight:"500" }}>{insightA}</div>
          <div style={{ color:"#0b5ed7", fontWeight:"500", marginTop:5 }}>{insightB}</div>
        </div>
      )}

      {/* 🔹 Charts */}
      {dataA.length>0 && dataB.length>0 && (
        <div style={{ maxWidth:980, margin:"0 auto 60px" }}>
          <h3 style={{ textAlign:"left" }}>Average Wage Comparison</h3>
          <div style={{ width:"100%", height:320 }}>
            <ResponsiveContainer>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="avg_wage" name={districtA} stroke="#0b5ed7" data={dataA} />
                <Line dataKey="avg_wage" name={districtB} stroke="#ff7f0f" data={dataB} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ textAlign:"left", marginTop: 24 }}>Employment Days Comparison</h3>
          <div style={{ width:"100%", height:320 }}>
            <ResponsiveContainer>
              <BarChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="emp_days" name={districtA} data={dataA} fill="#0b5ed7" />
                <Bar dataKey="emp_days" name={districtB} data={dataB} fill="#ff7f0f" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ textAlign:"left", marginTop: 24 }}>Women Persondays Trend</h3>
          <div style={{ width:"100%", height:320 }}>
            <ResponsiveContainer>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="women_persondays" name={districtA} data={dataA} stroke="#e83e8c" />
                <Line dataKey="women_persondays" name={districtB} data={dataB} stroke="#20c997" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

const cell = { padding: "10px", border: "1px solid #ddd", textAlign: "center" };

export default App;
