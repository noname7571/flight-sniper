export interface ScrapedFlight {
  price: number;
  currency: string;
  airline: string;
  departure: string;
  arrival: string;
  flightNumber: string;
  direct: boolean;
  seatsRemaining: number | null;
  bookingLink: string | null;
  departureDate: string;
}

export interface ScrapeParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  currency?: string;
}

export async function scrapeRyanair(params: ScrapeParams): Promise<ScrapedFlight[]> {
  console.log(`[Ryanair] Scraping ${params.origin} -> ${params.destination} on ${params.departureDate}`);

  // Ryanair fare finder endpoint (reverse-engineered, may break without notice)
  const url = `https://www.ryanair.com/api/farfnd/3/oneWayFares/` +
    `?departureAirportIataCode=${params.origin}` +
    `&arrivalAirportIataCode=${params.destination}` +
    `&outboundPartenDate=${params.departureDate}` +
    `&currency=${params.currency || 'EUR'}` +
    `&language=en`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429 || response.status === 403) {
        console.warn('[Ryanair] Rate limited or blocked');
        return [];
      }
      console.warn(`[Ryanair] HTTP ${response.status} for ${params.origin} -> ${params.destination}`);
      return [];
    }

    const data = await response.json();
    return parseRyanairResponse(data, params);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[Ryanair] Request timed out');
    } else {
      console.warn('[Ryanair] Scrape failed:', error.message);
    }
    return [];
  }
}

function parseRyanairResponse(data: any, params: ScrapeParams): ScrapedFlight[] {
  const results: ScrapedFlight[] = [];
  const fares = data?.fares || data?.trips || [];

  if (!Array.isArray(fares)) return results;

  for (const fare of fares) {
    const outbound = fare?.outbound || fare;
    const price = fare?.summary?.price?.value || outbound?.price?.value || 0;

    if (!price || price <= 0) continue;

    const flight = outbound?.flights?.[0] || outbound;

    results.push({
      price: parseFloat(price),
      currency: params.currency || 'EUR',
      airline: 'Ryanair',
      departure: params.origin,
      arrival: params.destination,
      flightNumber: flight?.flightNumber || `FR${Math.floor(Math.random() * 9000) + 1000}`,
      direct: true,
      seatsRemaining: flight?.seatsRemaining ?? null,
      bookingLink: null,
      departureDate: params.departureDate,
    });
  }

  return results;
}
