import cron from 'node-cron';
import { getAllRoutes, savePriceRecord, logAlert, MonitoredRoute } from './db';
import { searchFlights } from './api/serpapi';
import { scrapeRyanair } from './api/scrapers/ryanair';
import { scrapeWizzAir } from './api/scrapers/wizzair';
import { sendDiscordAlert } from './alerts/discord';
import { sendEmailAlert } from './alerts/email';

let isRunning = false;

function getNextCheckDate(daysAhead: number = 14): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

function getReturnDate(departureDate: string, stayDays: number = 7): string {
  const date = new Date(departureDate);
  date.setDate(date.getDate() + stayDays);
  return date.toISOString().split('T')[0];
}

function isDestinationAllowed(route: MonitoredRoute, destination: string): boolean {
  // Check include filter (if set, only allow listed destinations)
  if (route.include_destinations) {
    const allowed = route.include_destinations.split(',').map(s => s.trim());
    if (!allowed.includes(destination)) return false;
  }
  // Check exclude filter (if set, block listed destinations)
  if (route.exclude_destinations) {
    const blocked = route.exclude_destinations.split(',').map(s => s.trim());
    if (blocked.includes(destination)) return false;
  }
  return true;
}

async function checkRoute(route: MonitoredRoute): Promise<void> {
  console.log(`[Scheduler] Checking route: ${route.origin} -> ${route.destination}`);

  try {
    const departureDate = getNextCheckDate(14);
    const isReturn = route.return_ticket === 1;
    const returnDate = isReturn ? getReturnDate(departureDate) : undefined;

    // Primary source: SerpApi (Google Flights)
    let flights = await searchFlights({
      origin: route.origin,
      destination: route.destination,
      departureDate,
      returnDate,
      currency: route.currency,
    });

    // Fallback: try Ryanair scraper if no results
    if (flights.length === 0) {
      const ryanairFlights = await scrapeRyanair({
        origin: route.origin,
        destination: route.destination,
        departureDate,
        currency: route.currency,
      });
      flights.push(...ryanairFlights);
    }

    // Fallback: try Wizz Air scraper if still no results
    if (flights.length === 0) {
      const wizzFlights = await scrapeWizzAir({
        origin: route.origin,
        destination: route.destination,
        departureDate,
        currency: route.currency,
      });
      flights.push(...wizzFlights);
    }

    if (flights.length === 0) {
      console.log(`[Scheduler] No flights found for ${route.origin} -> ${route.destination}`);
      return;
    }

    for (const flight of flights) {
      // Apply include/exclude destination filters
      if (!isDestinationAllowed(route, flight.arrival)) continue;

      await savePriceRecord({
        route_id: route.id,
        price: flight.price,
        currency: flight.currency,
        airline: flight.airline,
        departure_date: flight.departureDate,
        flight_number: flight.flightNumber,
        direct: flight.direct ? 1 : 0,
        seats_remaining: flight.seatsRemaining,
        booking_link: flight.bookingLink,
      });

      if (flight.price <= route.max_price) {
        console.log(`[Scheduler] Price alert! ${route.origin} -> ${flight.arrival}: ${flight.price} ${route.currency} (under ${route.max_price})`);

        const alertPayload = {
          origin: route.origin,
          destination: flight.arrival,
          price: flight.price,
          maxPrice: route.max_price,
          currency: flight.currency,
          airline: flight.airline,
          departureDate,
          direct: flight.direct,
          bookingLink: flight.bookingLink,
        };

        if (route.discord_webhook) {
          const sent = await sendDiscordAlert(route.discord_webhook, alertPayload);
          if (sent) {
            await logAlert(route.id, flight.price, route.max_price, 'discord');
          }
        }

        if (route.email) {
          const sent = await sendEmailAlert({ ...alertPayload, to: route.email });
          if (sent) {
            await logAlert(route.id, flight.price, route.max_price, 'email');
          }
        }
      }
    }
  } catch (error) {
    console.error(`[Scheduler] Error checking route ${route.origin} -> ${route.destination}:`, error);
  }
}

export async function runAllChecks(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Previous check still running, skipping...');
    return;
  }

  isRunning = true;
  console.log('[Scheduler] Starting price check for all routes...');

  try {
    const routes = await getAllRoutes();
    console.log(`[Scheduler] Found ${routes.length} active routes to check`);

    // Process routes sequentially to avoid overwhelming APIs
    for (const route of routes) {
      await checkRoute(route);
    }

    console.log(`[Scheduler] Check complete. ${routes.length} routes checked`);
  } catch (error) {
    console.error('[Scheduler] Fatal error in check cycle:', error);
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  console.log('[Scheduler] Initializing...');

  // Run every hour by default
  cron.schedule('0 * * * *', () => {
    console.log('[Scheduler] Cron trigger: hourly check');
    runAllChecks();
  });

  // Also run immediately on startup
  console.log('[Scheduler] Running initial check...');
  runAllChecks();

  console.log('[Scheduler] Running. Next automatic check at the top of the next hour.');
}
