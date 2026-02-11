import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OptimizationService from '../services/optimization.service';

const RouteSheet = () => {
  const { id } = useParams();
  const [optimization, setOptimization] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await OptimizationService.get(id);
        setOptimization(data);
      } catch (e) {
        // noop
      }
    })();
  }, [id]);

  useEffect(() => {
    document.body.classList.add('print-friendly');
    return () => document.body.classList.remove('print-friendly');
  }, []);

  if (!optimization) return <div className="container mx-auto px-6 py-8">Loading...</div>;



  return (
    <div className="container mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Route Sheets: {optimization.name}</h1>
      <button className="btn btn-outline mb-6" onClick={() => window.print()}>Print</button>
      <div className="grid md:grid-cols-2 gap-6">
        {optimization.routes.map((route, idx) => (
          <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <div className="mb-4">
              <div className="text-lg font-semibold">Vehicle: {route.vehicleName || `Route ${idx+1}`}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Stops: {route.stops.length}</div>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              {route.stops.map((s, i) => (
                <li key={i}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div>
                      {s.locationName} {s.demand ? `(Demand: ${s.demand})` : ''}
                    </div>
                    {i === 0 ? (
                      <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '500' }}>
                        🏁 Start: {s.eta || '8:00 AM'}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>
                        {s.distanceFromPrev && <span>📍 {s.distanceFromPrev.toFixed(2)} km from prev</span>}
                        {s.distanceFromPrev && s.eta && <span> • </span>}
                        {s.eta && <span>⏱️ ETA: {s.eta}</span>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouteSheet;