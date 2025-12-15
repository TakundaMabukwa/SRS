// Test different possible video API endpoints
const baseUrl = 'http://localhost:3000';

const endpoints = [
  '/api/stream/vehicles/streams',
  '/api/stream/vehicles',
  '/api/vehicles/streams',
  '/stream/vehicles/streams',
  '/api/video/streams',
  '/api/stream',
];

async function testEndpoints() {
  console.log(`Testing endpoints on: ${baseUrl}\n`);

  for (const path of endpoints) {
    const url = `${baseUrl}${path}`;
    console.log(`\nTrying: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allChannels: true, onlineOnly: true })
      });
      
      console.log(`  Status: ${response.status}`);
      
      if (response.status !== 404) {
        const text = await response.text();
        console.log(`  ✅ Found! Response:`);
        console.log(text.substring(0, 200));
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

testEndpoints().catch(console.error);


## Error Type
Console AbortError

## Error Message
The fetching process for the media resource was aborted by the user agent at the user's request.


    at VideoFeedsPage.useEffect (src\app\(protected)\video-feeds\page.tsx:162:20)
    at VideoFeedsPage.useEffect (src\app\(protected)\video-feeds\page.tsx:157:41)

## Code Frame
  160 |             player.pause();
  161 |             player.unload();
> 162 |             player.detachMediaElement();
      |                    ^
  163 |             player.destroy();
  164 |           } catch (e) {}
  165 |         }

Next.js version: 15.5.7 (Webpack)
