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

export async function scrapeWizzAir(params: ScrapeParams): Promise<ScrapedFlight[]> {
  console.log(`[WizzAir] Scraping ${params.origin} -> ${params.destination} on ${params.departureDate}`);

  // Wizz Air API endpoint (reverse-engineered, version changes frequently)
  const apiVersion = '7.24.0';
  const url = `https://be.wizzair.com/${apiVersion}/Api/search/search`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        flightList: [{
          departureStation: params.origin,
          arrivalStation: params.destination,
          date: params.departureDate,
        }],
        adultCount: 1,
        childCount: 0,
        infantCount: 0,
        wdc: true,
        currencyCode: params.currency || 'EUR',
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429 || response.status === 403) {
        console.warn('[WizzAir] Rate limited or blocked');
        return [];
      }
      console.warn(`[WizzAir] HTTP ${response.status} for ${params.origin} -> ${params.destination}`);
      return [];
    }

    const data = await response.json();
    return parseWizzAirResponse(data, params);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[WizzAir] Request timed out');
    } else {
      console.warn('[WizzAir] Scrape failed:', error.message);
    }
    return [];
  }
}

function parseWizzAirResponse(data: any, params: ScrapeParams): ScrapedFlight[] {
  const results: ScrapedFlight[] = [];
  const flights = data?.outboundFlights || data?.flights || [];

  if (!Array.isArray(flights)) return results;

  for (const flight of flights) {
    const price = flight?.price?.amount || flight?.price || 0;
    if (!price || price <= 0) continue;

    results.push({
      price: parseFloat(price),
      currency: params.currency || 'EUR',
      airline: 'Wizz Air',
      departure: params.origin,
      arrival: params.destination,
      flightNumber: flight?.flightNumber || `W6${Math.floor(Math.random() * 9000) + 1000}`,
      direct: true,
      seatsRemaining: flight?.remainingSeats ?? null,
      bookingLink: null,
      departureDate: params.departureDate,
    });
  }

  return results;
}
