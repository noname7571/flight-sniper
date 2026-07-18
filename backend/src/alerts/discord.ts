export interface DiscordAlertPayload {
  origin: string;
  destination: string;
  price: number;
  maxPrice: number;
  currency: string;
  airline: string;
  departureDate: string;
  direct: boolean;
  bookingLink: string | null;
}

export async function sendDiscordAlert(webhookUrl: string, payload: DiscordAlertPayload): Promise<boolean> {
  const stopsText = payload.direct ? 'Direct flight' : 'With stops';
  const linkText = payload.bookingLink
    ? `\n[Book this flight](https://serpapi.com/search?engine=google_flights&booking_token=${encodeURIComponent(payload.bookingLink)})`
    : '';

  const embed = {
    title: `Flight Price Alert! ${payload.origin} -> ${payload.destination}`,
    color: 0x00ff00,
    fields: [
      {
        name: 'Price',
        value: `${payload.price} ${payload.currency}`,
        inline: true,
      },
      {
        name: 'Target Price',
        value: `Under ${payload.maxPrice} ${payload.currency}`,
        inline: true,
      },
      {
        name: 'Airline',
        value: payload.airline,
        inline: true,
      },
      {
        name: 'Date',
        value: payload.departureDate,
        inline: true,
      },
      {
        name: 'Type',
        value: stopsText,
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  const body = {
    content: `@everyone Cheap flight found: ${payload.origin} -> ${payload.destination} for ${payload.price} ${payload.currency}!${linkText}`,
    embeds: [embed],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[Discord] Webhook failed: ${response.status}`);
      return false;
    }

    console.log(`[Discord] Alert sent successfully for ${payload.origin} -> ${payload.destination}`);
    return true;
  } catch (error) {
    console.error('[Discord] Failed to send alert:', error);
    return false;
  }
}
