export interface FlightResult {
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

export interface SerpApiParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  currency?: string;
}

export async function searchFlights(params: SerpApiParams): Promise<FlightResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.warn('[SerpApi] No API key configured. Using mock data for development.');
    return getMockResults(params);
  }

  const searchParams = new URLSearchParams({
    engine: 'google_flights',
    api_key: apiKey,
    departure_id: params.origin,
    arrival_id: params.destination,
    outbound_date: params.departureDate,
    currency: params.currency || 'EUR',
    hl: 'en',
  });

  if (params.returnDate) {
    searchParams.set('return_date', params.returnDate);
  }

  // Indicate if this is a round trip search
  const isRoundTrip = !!params.returnDate;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`https://serpapi.com/search?${searchParams.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[SerpApi] Rate limited, will retry later');
        return [];
      }
      throw new Error(`SerpApi error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    // Check for API errors
    if (data.error) {
      console.error('[SerpApi] API error:', data.error);
      return [];
    }

    const results = parseSerpApiResponse(data);

    // For round trips, we also check return flights
    if (isRoundTrip && data.return_flights) {
      const returnResults = parseSerpApiReturnFlights(data);
      // Combine both directions
      return [...results, ...returnResults];
    }

    return results;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[SerpApi] Request timed out');
      return [];
    }
    console.error('[SerpApi] Search failed:', error);
    return [];
  }
}

function parseSerpApiReturnFlights(data: Record<string, any>): FlightResult[] {
  const results: FlightResult[] = [];
  const returnFlights = data?.return_flights || [];
  const otherReturnFlights = data?.other_return_flights || [];
  const allFlights = [...returnFlights, ...otherReturnFlights];

  for (const flight of allFlights) {
    const firstLeg = flight.flights?.[0];
    if (!firstLeg) continue;

    const lastLeg = flight.flights?.[flight.flights.length - 1] || firstLeg;

    results.push({
      price: flight.price || 0,
      currency: data?.search_parameters?.currency || 'EUR',
      airline: firstLeg.airline || 'Unknown',
      departure: firstLeg.departure_airport?.name || '',
      arrival: lastLeg.arrival_airport?.name || '',
      flightNumber: firstLeg.flight_number || '',
      direct: (flight.flights?.length || 0) === 1,
      seatsRemaining: firstLeg.seats_remaining ?? null,
      bookingLink: flight.booking_token ?? null,
      departureDate: firstLeg.departure_airport?.time || '',
    });
  }

  return results;
}

function parseSerpApiResponse(data: Record<string, any>): FlightResult[] {
  const results: FlightResult[] = [];
  const bestFlights = data?.best_flights || [];
  const otherFlights = data?.other_flights || [];
  const allFlights = [...bestFlights, ...otherFlights];

  for (const flight of allFlights) {
    const firstLeg = flight.flights?.[0];
    if (!firstLeg) continue;

    const lastLeg = flight.flights?.[flight.flights.length - 1] || firstLeg;

    results.push({
      price: flight.price || 0,
      currency: data?.search_parameters?.currency || 'EUR',
      airline: firstLeg.airline || 'Unknown',
      departure: firstLeg.departure_airport?.name || '',
      arrival: lastLeg.arrival_airport?.name || '',
      flightNumber: firstLeg.flight_number || '',
      direct: (flight.flights?.length || 0) === 1,
      seatsRemaining: firstLeg.seats_remaining ?? null,
      bookingLink: flight.booking_token ?? null,
      departureDate: firstLeg.departure_airport?.time || '',
    });
  }

  return results;
}

function getMockResults(params: SerpApiParams): FlightResult[] {
  const basePrice = Math.floor(Math.random() * 200) + 30;
  return [
    {
      price: basePrice,
      currency: params.currency || 'EUR',
      airline: 'Ryanair',
      departure: params.origin,
      arrival: params.destination,
      flightNumber: `FR${Math.floor(Math.random() * 9000) + 1000}`,
      direct: Math.random() > 0.3,
      seatsRemaining: Math.random() > 0.5 ? Math.floor(Math.random() * 50) + 1 : null,
      bookingLink: null,
      departureDate: params.departureDate,
    },
    {
      price: basePrice + Math.floor(Math.random() * 60) + 10,
      currency: params.currency || 'EUR',
      airline: 'Wizz Air',
      departure: params.origin,
      arrival: params.destination,
      flightNumber: `W6${Math.floor(Math.random() * 9000) + 1000}`,
      direct: Math.random() > 0.2,
      seatsRemaining: Math.random() > 0.5 ? Math.floor(Math.random() * 30) + 1 : null,
      bookingLink: null,
      departureDate: params.departureDate,
    },
  ];
}
