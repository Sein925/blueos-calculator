const SUPABASE_URL = 'https://cwptfdtgzdhcufulffgi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3cHRmZHRnemRoY3VmdWxmZ2kiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc0NTAwNzk5OSwiZXhwIjoyMDYwNTgzOTk5fQ.3B2M21Uq6fF4pR0Y5eQ7wX8z9aB0cD1eF2gH3iJ4k';

export async function supabaseGet(table, filters = {}, options = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${options.columns || '*'}`;
  
  Object.keys(filters).forEach(key => {
    const value = filters[key];
    if (value !== undefined && value !== null) {
      url += `&${key}=eq.${encodeURIComponent(value)}`;
    }
  });
  
  if (options.orderBy) {
    const dir = options.ascending === false ? 'desc' : 'asc';
    url += `&order=${options.orderBy}.${dir}`;
  }
  
  if (options.limit) {
    url += `&limit=${options.limit}`;
  }
  
  console.log('[Supabase] GET', url);
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Supabase] GET error', error);
    throw new Error(`Supabase GET error: ${error}`);
  }
  
  const data = await response.json();
  console.log('[Supabase] GET result', data);
  return data;
}

export async function supabaseInsert(table, data) {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  
  console.log('[Supabase] INSERT', url, data);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Supabase] INSERT error', error);
    throw new Error(`Supabase INSERT error: ${error}`);
  }
  
  console.log('[Supabase] INSERT success');
}

export async function supabaseUpdate(table, filters, data) {
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  
  let filterCount = 0;
  Object.keys(filters).forEach(key => {
    const value = filters[key];
    if (value !== undefined && value !== null) {
      url += filterCount === 0 ? '?' : '&';
      url += `${key}=eq.${encodeURIComponent(value)}`;
      filterCount++;
    }
  });
  
  console.log('[Supabase] UPDATE', url, data);
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[Supabase] UPDATE error', error);
    throw new Error(`Supabase UPDATE error: ${error}`);
  }
  
  console.log('[Supabase] UPDATE success');
}
