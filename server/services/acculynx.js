import fetch from 'node-fetch';

const BASE_URL = 'https://api.acculynx.com/api/v2';

function headers(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export async function testConnection(apiKey) {
  const res = await fetch(`${BASE_URL}/diagnostics/ping`, {
    method: 'GET',
    headers: headers(apiKey),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AccuLynx ping failed: ${res.status} ${body}`);
  }
  return true;
}

export async function createContact(apiKey, { firstName, lastName, phone, address }) {
  const body = {
    // contactTypeIds is required; 1 = Homeowner (most common AccuLynx default)
    contactTypeIds: [1],
    firstName: firstName || '',
    lastName: lastName || '',
  };

  if (phone) {
    body.phoneNumbers = [{ number: phone.replace(/\D/g, ''), type: 'mobile' }];
  }

  if (address) {
    body.mailingAddress = { line1: address };
  }

  const res = await fetch(`${BASE_URL}/contacts`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`AccuLynx createContact failed: ${res.status} ${errBody}`);
  }

  return res.json();
}

export async function createJob(apiKey, { contactId, address, notes }) {
  const body = {
    contact: { id: contactId },
  };

  if (address) {
    body.locationAddress = { line1: address };
  }

  if (notes) {
    body.notes = notes.slice(0, 1000);
  }

  const res = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`AccuLynx createJob failed: ${res.status} ${errBody}`);
  }

  return res.json();
}
