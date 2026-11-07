async function testPut() {
  try {
    const id = 'ff808181a09d98f701a1b3ff4ce158b7';
    const res = await fetch(`https://api.restful-api.dev/objects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'incha-pos-sync', data: { updated: true, count: 5 } })
    });
    const json = await res.json();
    console.log('Updated:', json);
  } catch (e) {
    console.error('Error:', e);
  }
}
testPut();
