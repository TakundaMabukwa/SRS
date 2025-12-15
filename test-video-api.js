// Test script for video API endpoint
const baseUrl = 'http://64.227.126.176:3001';
const endpoint = `${baseUrl}/api/stream/vehicles/streams`;

async function testVideoAPI() {
  console.log('Testing Video API Endpoint...\n');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Full Endpoint: ${endpoint}\n`);

  try {
    console.log('Sending POST request...');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allChannels: true,
        onlineOnly: true,
        timeout: 5000
      })
    });
    
    console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    console.log(`\nContent-Type: ${contentType}\n`);
    
    const text = await response.text();
    console.log('Raw Response Body:');
    console.log(text);
    console.log('\n---\n');
    
    if (response.status === 404) {
      console.log('❌ 404 Not Found - Endpoint does not exist');
      return;
    }
    
    try {
      const data = JSON.parse(text);
      console.log('✅ Valid JSON Response:');
      console.log(JSON.stringify(data, null, 2));

      if (data.data?.vehicles) {
        console.log(`\n✅ Found ${data.data.vehicles.length} vehicles with video streams:`);
        data.data.vehicles.forEach((vehicle, index) => {
          console.log(`\n${index + 1}. ${vehicle.plateName}`);
          console.log(`   Device ID: ${vehicle.deviceId}`);
          console.log(`   Cameras: ${vehicle.cameras}`);
          console.log(`   Channels: ${vehicle.channels.length}`);
          vehicle.channels.forEach(channel => {
            console.log(`   - Camera ${channel.channelId}: ${channel.streamUrl}`);
          });
        });
      } else {
        console.log('\n⚠️ No vehicles found in response');
      }
    } catch (parseError) {
      console.log('❌ Response is not valid JSON');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testVideoAPI().catch(console.error);
