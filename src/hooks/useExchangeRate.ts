import { useState, useEffect } from 'react';
import { db } from '../api/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export interface ExchangeRate {
  id?: string;
  rate: number;
  source: string;
  date: any;
  createdAt: any;
}

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Escucha en tiempo real la última tasa ordenada por fecha
    const q = query(
      collection(db, 'exchange_rates'),
      orderBy('date', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as ExchangeRate;
        setExchangeRate({ id: snapshot.docs[0].id, ...data });
        setLoading(false);
      } else {
        // Fallback: Si no hay Cloud Function (Plan Free), el Front-End hace de Scraper
        fetch('https://api.exchangerate-api.com/v4/latest/USD')
          .then(res => res.json())
          .then(data => {
            if (data && data.rates && data.rates.VES) {
              const rawRate = data.rates.VES;
              const correctedRate = Number(rawRate.toFixed(2));
              
              setExchangeRate({
                rate: correctedRate,
                source: 'frontend-scraper-proxy',
                date: { seconds: Math.floor(Date.now() / 1000) },
                createdAt: { seconds: Math.floor(Date.now() / 1000) }
              });
            } else {
              setExchangeRate(null);
            }
          })
          .catch(e => {
            console.error("Scraper fallback failed:", e);
            setExchangeRate(null);
          })
          .finally(() => setLoading(false));
      }
    }, (err) => {
      console.error("Error fetching exchange rate:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { exchangeRate, loading, error };
}
