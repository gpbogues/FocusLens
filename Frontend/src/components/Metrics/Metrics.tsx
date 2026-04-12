import MonthlyHeatmap from './MonthlyHeatmap';
import './Metrics.css';

const Metrics = () => {
  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <h2 className="page-heading">Metrics</h2>
      </div>
      <div className="metrics-section">
        <p className="metrics-section-label">Sessions per day</p>
        <MonthlyHeatmap />
      </div>
    </div>
  );
};

export default Metrics;
