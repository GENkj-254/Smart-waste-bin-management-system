// Test connection to backend
fetch('http://localhost:5000/api/bins')
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('✅ Connected to backend. Data received:', data);
    // You can display this in HTML too, if needed
  })
  .catch(error => {
    console.error('❌ Error connecting to backend:', error);
  });
